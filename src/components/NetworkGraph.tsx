/**
 * NetworkGraph — D3.js force-directed network visualization
 * Design: "Constellation" — dark elegant with depth, glowing nodes
 * Features: curved links, project cards with role slots, animated particles, hover highlights
 */
import { useNetwork, type MemberRole, ROLE_LABELS, ROLE_COLORS } from "@/contexts/NetworkContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// ─── Date helpers ────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "hub" | "member" | "project";
  color: string;
  role?: MemberRole;
  radius: number;
  status?: string;
  memberSlots?: { role: MemberRole; color: string; name: string }[];
  isMissingDates?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  color: string;
  memberId: string;
  projectId: string;
  cardTeamMemberId?: string;
  cardId?: string;
  role?: MemberRole;
}

interface NetworkGraphProps {
  onNodeClick?: (nodeId: string, nodeType: "member" | "project" | "hub") => void;
  onBackgroundClick?: () => void;
  onProjectHover?: (projectId: string | null) => void;
  onMemberHover?: (memberId: string | null) => void;
  highlightMember?: string | null;
  highlightProject?: string | null;
  filterRole?: MemberRole | "all";
  graphMode?: "agora" | "designado";
}

export default function NetworkGraph({
  onNodeClick,
  onBackgroundClick,
  onProjectHover,
  onMemberHover,
  highlightMember,
  highlightProject,
  filterRole = "all",
  graphMode = "agora",
}: NetworkGraphProps) {
  const { state, removeAssignmentByLink } = useNetwork();
  const { state: cardsState, updateTeamMember } = useProjectCards();
  const { state: scheduleState, getWeekRoster } = useSchedule();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const onProjectHoverRef = useRef(onProjectHover);
  onProjectHoverRef.current = onProjectHover;
  const onMemberHoverRef = useRef(onMemberHover);
  onMemberHoverRef.current = onMemberHover;
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const onBackgroundClickRef = useRef(onBackgroundClick);
  onBackgroundClickRef.current = onBackgroundClick;
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [, setTick] = useState(0); // Dummy state to force refresh


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Timer to refresh connections when period changes (at 13h or midnight)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  const buildGraphData = useCallback(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Hub
    nodes.push({
      id: "hub",
      label: "PUB",
      type: "hub",
      color: "#ffffff",
      radius: 42,
    });

    // --- Dynamic Team Members (based on Weekly Roster) ---
    const weekKey = formatDate(getMonday(new Date()));
    const rosterIds = getWeekRoster(weekKey, state.members.map(m => m.id));

    const filteredMembers = state.members.filter(m => {
      // 1. Must be in the weekly roster
      if (!rosterIds.includes(m.id)) return false;
      
      // 2. Role filter (if any)
      if (filterRole !== "all" && m.role !== filterRole) return false;

      // 3. Exclude Vinícius
      const name = m.name?.toLowerCase() || "";
      if (name.includes("vinicius") || name.includes("vinícius")) return false;

      return true;
    });

    filteredMembers.forEach((m) => {
      nodes.push({
        id: m.id,
        label: (m.name || "Sem Nome").toUpperCase(),
        type: "member",
        color: m.color || "#ffffff",
        role: m.role,
        radius: 26,
      });
    });

    // Map card team roles to network roles
    const roleMap: Record<string, MemberRole> = {
      criacao: "creative",
      arq: "architect",
      "3d": "3d",
    };

    const addedLinkIds = new Set<string>();

    // 1. Add ALL active projects as initial nodes (except PUB INTERNO)
    const pubInternoId = cardsState.cards.find(c => c.name === "PUB INTERNO")?.id;

    cardsState.cards.filter(card => card.active !== false && card.name !== "PUB INTERNO").forEach(card => {
      nodes.push({
        id: card.id,
        label: card.name || "Projeto sem Nome",
        type: "project",
        color: "#64748b",
        radius: 44,
        status: "active",
        memberSlots: [],
        isMissingDates: !card.entryDate || !card.deliveryDate,
      });
    });

    // Virtual DAYOFF satellite node
    const DAYOFF_NODE_ID = "__dayoff__";
    nodes.push({
      id: DAYOFF_NODE_ID,
      label: "DAYOFF",
      type: "project",
      color: "#92400e",
      radius: 36,
      status: "active",
      memberSlots: [],
    });

    // --- CONNECTIONS LOGIC ---
    if (graphMode === "agora") {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      const todayDate = new Date(todayStr + "T12:00:00");
      
      // Period definition: Morning (before 14h) vs Afternoon (from 14h)
      const isPM = now.getHours() >= 14;
      
      // Filter entries that are active in the current period of today
      const SLOTS_PER_DAY = 8;
      const todayEntries = scheduleState.entries.filter(e => {
        // Accept dayoff entries (no projectId) and normal project entries
        if (!e.projectId && e.activityId !== "dayoff") return false;
        
        const startDate = new Date(e.date + "T12:00:00");
        const diffDays = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // New slot system stores duration in slots (1–8 = up to 1 day).
        // Old system stores duration as day fractions (0.5 = half day, 1.0 = full day).
        // Convert to days for a correct range comparison.
        const isNewSlotSystem = e.startSlot !== undefined;
        const durationInDays = isNewSlotSystem
          ? (e.duration || 1) / SLOTS_PER_DAY
          : (e.duration || 1);

        // If today is outside the range [start, start + durationInDays)
        if (diffDays < 0 || diffDays >= durationInDays) return false;

        // Calculate entry's relative interval for today as a fraction of the day [0, 1]
        // startOffset for new system = startSlot / SLOTS_PER_DAY; old system uses startOffset directly
        const startFraction = isNewSlotSystem
          ? (e.startSlot! / SLOTS_PER_DAY)
          : (e.startOffset || 0);
        const entryDayStart = diffDays === 0 ? startFraction : 0;
        const entryDayEnd = entryDayStart + (durationInDays - diffDays);

        if (isPM) {
          return entryDayEnd > 0.5;
        } else {
          return entryDayStart < 0.5;
        }
      });

      // Map schedule entries to project slots and links
      todayEntries.forEach(entry => {
        const memberNode = nodes.find(n => n.id === entry.memberId && n.type === "member");
        if (!memberNode) return;

        // Dayoff entries connect to the DAYOFF satellite
        const isDayoff = entry.activityId === "dayoff";
        const isPubInterno = !isDayoff && entry.projectId === pubInternoId;
        const projNode = isDayoff
          ? nodes.find(n => n.id === DAYOFF_NODE_ID)
          : isPubInterno
            ? nodes.find(n => n.id === "hub")
            : nodes.find(n => n.id === entry.projectId && n.type === "project");
        
        if (!projNode) return;

        // If it's a project (not Hub or Dayoff), find the member's roles in that project card
        const card = cardsState.cards.find(c => c.id === entry.projectId);
        
        // Roles assigned to this member in THIS specific project card
        let rolesToDraw: MemberRole[] = [];
        
        if (card && card.team && Array.isArray(card.team)) {
          const memberInTeam = card.team.filter(tm => tm.name.toUpperCase() === memberNode.label);
          if (memberInTeam.length > 0) {
            rolesToDraw = memberInTeam.map(tm => roleMap[tm.role] || memberNode.role).filter(Boolean) as MemberRole[];
          }
        }

        // Fallback to member's main role if no specific card role found
        if (rolesToDraw.length === 0 && !isDayoff && !isPubInterno) {
          if (memberNode.role) rolesToDraw.push(memberNode.role);
        }

        // Special case for Hub/Dayoff: just one role/color
        if (isDayoff || isPubInterno || rolesToDraw.length === 0) {
          const targetId = isDayoff ? DAYOFF_NODE_ID : (isPubInterno ? "hub" : (entry.projectId as string));
          const linkId = `${memberNode.id}-${targetId}`;
          if (!addedLinkIds.has(linkId)) {
            addedLinkIds.add(linkId);
            links.push({
              id: linkId,
              source: memberNode.id,
              target: projNode.id,
              color: isDayoff ? "#92400e" : memberNode.color,
              memberId: memberNode.id,
              projectId: targetId,
              role: isDayoff ? undefined : memberNode.role,
            });
          }
        } else {
          // Normal project: Draw one tentacle per role defined in the card
          rolesToDraw.forEach(role => {
            const linkId = `${memberNode.id}-${entry.projectId}-${role}`;
            if (!addedLinkIds.has(linkId)) {
              addedLinkIds.add(linkId);
              links.push({
                id: linkId,
                source: memberNode.id,
                target: projNode.id,
                color: ROLE_COLORS[role] || memberNode.color,
                memberId: memberNode.id,
                projectId: entry.projectId as string,
                role: role,
              });
              
              // Also add to project slots for the card label
              if (projNode.type === "project" && projNode.memberSlots) {
                const alreadyInSlot = projNode.memberSlots.some(s => s.name === memberNode.label && s.role === role);
                if (!alreadyInSlot) {
                  projNode.memberSlots.push({
                    role,
                    color: ROLE_COLORS[role] || memberNode.color,
                    name: memberNode.label
                  });
                }
              }
            }
          });
        }
      });
    } else {
      // "designado" mode
      cardsState.cards.forEach(card => {
        // Only active projects (or PUB INTERNO) will attach links
        if (card.active === false) return;
        
        const isPubInterno = card.id === pubInternoId;
        const projNode = isPubInterno
          ? nodes.find(n => n.id === "hub")
          : nodes.find(n => n.id === card.id && n.type === "project");

        if (!projNode) return;

        if (card.team && Array.isArray(card.team)) {
          card.team.forEach(tm => {
            // Match team member by name since IDs might be from project card internal roster
            const teamMemberNameUppercase = tm.name.toUpperCase();
            const memberNode = nodes.find(n => n.label === teamMemberNameUppercase && n.type === "member");
            if (!memberNode) return;

            if (projNode.type === "project" && projNode.memberSlots) {
              const alreadyAdded = projNode.memberSlots.some(s => s.name === memberNode.label);
              if (!alreadyAdded) {
                projNode.memberSlots.push({
                  role: memberNode.role!,
                  color: memberNode.color,
                  name: memberNode.label
                });
              }
            }

            const effectiveRole = roleMap[tm.role] || memberNode.role;
            const linkId = `${memberNode.id}-${card.id}-${effectiveRole || "default"}`;
            
            if (!addedLinkIds.has(linkId)) {
              addedLinkIds.add(linkId);
              links.push({
                id: linkId,
                source: memberNode.id,
                target: projNode.id,
                color: effectiveRole ? ROLE_COLORS[effectiveRole] : memberNode.color,
                memberId: memberNode.id,
                projectId: card.id,
                role: effectiveRole,
              });
            }
          });
        }
      });
    }

    // Remove DAYOFF node if nobody is on dayoff
    const dayoffHasLinks = links.some(l => l.projectId === "__dayoff__");
    if (!dayoffHasLinks) {
      const idx = nodes.findIndex(n => n.id === "__dayoff__");
      if (idx !== -1) nodes.splice(idx, 1);
    }

    return { nodes, links };
  }, [state, cardsState, scheduleState, filterRole, graphMode]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const { nodes, links } = buildGraphData();

    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // Glow filters
    const makeGlow = (id: string, std: number) => {
      const f = defs.append("filter").attr("id", id).attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      f.append("feGaussianBlur").attr("stdDeviation", std).attr("result", "blur");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "blur");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    makeGlow("glow", 4);
    makeGlow("hubGlow", 10);
    makeGlow("linkGlow", 2);

    // Shadow filter for project cards
    const shadow = defs.append("filter").attr("id", "cardShadow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    shadow.append("feDropShadow").attr("dx", 0).attr("dy", 2).attr("stdDeviation", 6).attr("flood-color", "rgba(0,0,0,0.5)");

    // Grid pattern
    const gridPattern = defs
      .append("pattern")
      .attr("id", "grid")
      .attr("width", 50)
      .attr("height", 50)
      .attr("patternUnits", "userSpaceOnUse");
    gridPattern
      .append("circle")
      .attr("cx", 25)
      .attr("cy", 25)
      .attr("r", 0.6)
      .attr("fill", "rgba(255,255,255,0.04)");

    const g = svg.append("g");

    // Background
    g.append("rect")
      .attr("width", width * 6)
      .attr("height", height * 6)
      .attr("x", -width * 3)
      .attr("y", -height * 3)
      .attr("fill", "url(#grid)");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom as any);

    svg.on("click", () => {
      if (onBackgroundClickRef.current) {
        onBackgroundClickRef.current();
      }
    });

    // Curved links
    const linkGroup = g.append("g").attr("class", "links");
    const linkElements = linkGroup
      .selectAll("g.link-group")
      .data(links)
      .join("g")
      .attr("class", "link-group");

    // Visible link path
    const linkPaths = linkElements
      .append("path")
      .attr("class", "link-path")
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5)
      .attr("filter", "url(#linkGlow)");

    // Invisible wider hit area for hover
    const linkHitAreas = linkElements
      .append("path")
      .attr("class", "link-hit")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 20)
      .attr("cursor", "pointer");

    // Hover: path highlight only
    linkElements
      .on("mouseenter", function () {
        d3.select(this).select(".link-path")
          .transition().duration(150).attr("stroke-width", 4).attr("stroke-opacity", 0.9);
      })
      .on("mouseleave", function () {
        d3.select(this).select(".link-path")
          .transition().duration(150).attr("stroke-width", 2).attr("stroke-opacity", 0.5);
      });

    // Animated particles on links
    const particleGroup = g.append("g").attr("class", "particles");
    const particles = particleGroup
      .selectAll("circle")
      .data(links)
      .join("circle")
      .attr("r", 2.5)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.8)
      .attr("filter", "url(#glow)");

    const nodeGroup = g.append("g").attr("class", "nodes");
    const nodeElements = nodeGroup
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        _event.stopPropagation();
        if (onNodeClickRef.current && d.type !== "hub") {
          onNodeClickRef.current(d.id, d.type as "member" | "project");
        }
      });

    // Drag
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeElements.call(drag as any);

    // ─── Draw DAYOFF satellite node (circle, not card) ───
    nodeElements
      .filter((d) => d.id === "__dayoff__")
      .each(function (d) {
        const el = d3.select(this);
        const r = d.radius;

        // Outer dashed ring
        el.append("circle")
          .attr("r", r + 10)
          .attr("fill", "none")
          .attr("stroke", "rgba(146, 64, 14, 0.3)")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4 3");

        // Warm glow ring
        el.append("circle")
          .attr("r", r + 4)
          .attr("fill", "none")
          .attr("stroke", "rgba(146, 64, 14, 0.25)")
          .attr("stroke-width", 2);

        // Main circle
        el.append("circle")
          .attr("r", r)
          .attr("fill", "rgba(146, 64, 14, 0.2)")
          .attr("stroke", "#92400e")
          .attr("stroke-width", 2)
          .attr("filter", "url(#glow)");

        // Inner subtle circle
        el.append("circle")
          .attr("r", r - 3)
          .attr("fill", "none")
          .attr("stroke", "rgba(146, 64, 14, 0.15)")
          .attr("stroke-width", 1);

        // DAYOFF label
        el.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("fill", "#fbbf24")
          .attr("font-size", "11px")
          .attr("font-weight", "800")
          .attr("font-family", "Sora, sans-serif")
          .attr("letter-spacing", "0.1em")
          .text("DAYOFF");
      });

    // ─── Draw PROJECT nodes (cards with role slots) ───
    nodeElements
      .filter((d) => d.type === "project" && d.id !== "__dayoff__")
      .each(function (d) {
        const el = d3.select(this);
        const w = d.radius * 2 + 10;
        const h = d.radius * 2 + 10;

        // Card background
        el.append("rect")
          .attr("x", -w / 2)
          .attr("y", -h / 2)
          .attr("width", w)
          .attr("height", h)
          .attr("rx", 14)
          .attr("fill", "rgba(12, 17, 30, 0.92)")
          .attr("stroke", (d: any) => d.isMissingDates ? "rgba(234, 179, 8, 0.8)" : "rgba(255,255,255,0.12)")
          .attr("stroke-width", (d: any) => d.isMissingDates ? 2 : 1.5)
          .attr("filter", "url(#cardShadow)");

        // Inner border glow
        el.append("rect")
          .attr("x", -w / 2 + 2)
          .attr("y", -h / 2 + 2)
          .attr("width", w - 4)
          .attr("height", h - 4)
          .attr("rx", 12)
          .attr("fill", "none")
          .attr("stroke", (d: any) => d.isMissingDates ? "rgba(234, 179, 8, 0.3)" : "rgba(255,255,255,0.05)")
          .attr("stroke-width", 1);

        // Status dot
        const statusColor =
          d.status === "active" ? "#22c55e" : d.status === "paused" ? "#eab308" : "#6b7280";
        el.append("circle")
          .attr("cx", w / 2 - 10)
          .attr("cy", -h / 2 + 10)
          .attr("r", 4)
          .attr("fill", statusColor)
          .attr("filter", "url(#glow)");

        // Project name with multiline support
        const text = el.append("text")
          .attr("text-anchor", "middle")
          .attr("fill", "#e2e8f0")
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .attr("font-family", "Sora, sans-serif")
          .attr("letter-spacing", "0.04em");

        const hasSlots = d.memberSlots && d.memberSlots.length > 0;
        const labelText = d.label || "";
        const words = labelText.split(/\s+/).filter(Boolean);
        let line: string[] = [];
        const lines: string[] = [];
        const maxChars = 10;
        
        words.forEach(word => {
          if ((line.join(" ") + " " + word).length > maxChars && line.length > 0) {
            lines.push(line.join(" "));
            line = [word];
          } else {
            line.push(word);
          }
        });
        if (line.length > 0) lines.push(line.join(" "));

        const lineHeight = 11;
        const totalHeight = lines.length * lineHeight;
        const startY = (hasSlots ? -totalHeight / 2 - 2 : -totalHeight / 2 + 5);

        lines.forEach((l, i) => {
          text.append("tspan")
            .attr("x", 0)
            .attr("y", startY + i * lineHeight)
            .text(l);
        });

        // Role slots (mini circles inside card)
        if (d.memberSlots && d.memberSlots.length > 0) {
          const slotSize = 12;
          const totalWidth = d.memberSlots.length * (slotSize + 4) - 4;
          const startX = -totalWidth / 2;
          const slotY = 14;

          d.memberSlots.forEach((slot, i) => {
            const sx = startX + i * (slotSize + 4) + slotSize / 2;

            el.append("circle")
              .attr("cx", sx)
              .attr("cy", slotY)
              .attr("r", slotSize / 2)
              .attr("fill", slot.color)
              .attr("opacity", 0.9)
              .attr("stroke", "rgba(255,255,255,0.2)")
              .attr("stroke-width", 1);

            // Role abbreviation
            const roleAbbr =
              slot.role === "creative" ? "C" : slot.role === "architect" ? "A" : "3D";
            el.append("text")
              .attr("x", sx)
              .attr("y", slotY)
              .attr("text-anchor", "middle")
              .attr("dy", "0.35em")
              .attr("fill", "#ffffff")
              .attr("font-size", "6px")
              .attr("font-weight", "700")
              .attr("font-family", "Sora, sans-serif")
              .text(roleAbbr);
          });
        }
      });

    // ─── Draw MEMBER nodes (circles with glow) ───
    nodeElements
      .filter((d) => d.type === "member")
      .each(function (d) {
        const el = d3.select(this);

        // Outer pulse ring
        el.append("circle")
          .attr("r", d.radius + 6)
          .attr("fill", "none")
          .attr("stroke", d.color)
          .attr("stroke-width", 1)
          .attr("opacity", 0.25)
          .attr("class", "pulse-ring");

        // Main circle
        el.append("circle")
          .attr("r", d.radius)
          .attr("fill", d.color)
          .attr("filter", "url(#glow)")
          .attr("opacity", 0.92);

        // Highlight ring
        el.append("circle")
          .attr("r", d.radius - 2)
          .attr("fill", "none")
          .attr("stroke", "rgba(255,255,255,0.2)")
          .attr("stroke-width", 1);

        // Name
        el.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "-0.15em")
          .attr("fill", "#ffffff")
          .attr("font-size", "11px")
          .attr("font-weight", "700")
          .attr("font-family", "Sora, sans-serif")
          .attr("letter-spacing", "0.02em")
          .text(d.label);

        // Role
        el.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "1.1em")
          .attr("fill", "rgba(255,255,255,0.65)")
          .attr("font-size", "7px")
          .attr("font-weight", "500")
          .attr("font-family", "Inter, sans-serif")
          .attr("letter-spacing", "0.1em")
          .text(d.role ? ROLE_LABELS[d.role].toUpperCase() : "");
      });

    // ─── Draw HUB node ───
    nodeElements
      .filter((d) => d.type === "hub")
      .each(function (d) {
        const el = d3.select(this);

        // Outer rings
        el.append("circle")
          .attr("r", d.radius + 16)
          .attr("fill", "none")
          .attr("stroke", "rgba(255,255,255,0.06)")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4 4");

        el.append("circle")
          .attr("r", d.radius + 8)
          .attr("fill", "none")
          .attr("stroke", "rgba(255,255,255,0.1)")
          .attr("stroke-width", 1.5);

        // Main circle
        el.append("circle")
          .attr("r", d.radius)
          .attr("fill", "#0c111e")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2.5)
          .attr("filter", "url(#hubGlow)");

        // Inner gradient circle
        el.append("circle")
          .attr("r", d.radius - 4)
          .attr("fill", "none")
          .attr("stroke", "rgba(255,255,255,0.08)")
          .attr("stroke-width", 1);

        // PUB text
        el.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("fill", "#ffffff")
          .attr("font-size", "20px")
          .attr("font-weight", "800")
          .attr("font-family", "Sora, sans-serif")
          .attr("letter-spacing", "0.15em")
          .text("PUB");
      });

    // Highlight logic
    const highlightId = highlightMember || highlightProject;
    if (highlightId) {
      const connectedLinks = links.filter(
        (l) => l.memberId === highlightId || l.projectId === highlightId
      );
      const connectedNodeIds = new Set<string>();
      connectedNodeIds.add(highlightId);
      connectedLinks.forEach((l) => {
        connectedNodeIds.add(l.memberId);
        connectedNodeIds.add(l.projectId);
      });

      nodeElements.attr("opacity", (d) =>
        connectedNodeIds.has(d.id) || d.type === "hub" ? 1 : 0.12
      );
      linkPaths.attr("stroke-opacity", (d: GraphLink) =>
        connectedLinks.some((cl) => cl.id === d.id) ? 0.8 : 0.03
      );
      particles.attr("opacity", (d: GraphLink) =>
        connectedLinks.some((cl) => cl.id === d.id) ? 0.8 : 0
      );
    }

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(160)
          .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-500).distanceMax(600))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 25).strength(0.8)
      )
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04));

    // Pin hub
    const hubNode = nodes.find((n) => n.type === "hub");
    if (hubNode) {
      hubNode.fx = width / 2;
      hubNode.fy = height / 2;
    }

    const linkPath = (d: GraphLink) => {
      const s = d.source as GraphNode;
      const t = d.target as GraphNode;
      const dx = t.x! - s.x!;
      const dy = t.y! - s.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Role-based curve offset to prevent overlap
      const roleOffset = d.role === "creative" ? 0.7 : d.role === "architect" ? 0.9 : 1.1;
      const dr = dist * roleOffset;

      // Offset start point to source border (member circles)
      const sRadius = (s.type === "member" || s.id === "__dayoff__") ? s.radius : 0;
      const sx = s.x! + (dx / dist) * sRadius;
      const sy = s.y! + (dy / dist) * sRadius;

      // Offset end point to target border (DAYOFF circle, member circles)
      const tRadius = (t.type === "member" || t.id === "__dayoff__") ? t.radius : 0;
      const tx = t.x! - (dx / dist) * tRadius;
      const ty = t.y! - (dy / dist) * tRadius;

      return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
    };

    // Particle animation
    let particleT = 0;
    const animateParticles = () => {
      particleT += 0.004;
      particles.each(function (this: any, d: GraphLink) {
        const pathEl = linkPaths
          .filter((l: GraphLink) => l.id === d.id)
          .node() as SVGPathElement | null;
        if (pathEl) {
          try {
            const len = pathEl.getTotalLength();
            const t = ((particleT * 1000 + parseInt(d.id.replace(/\D/g, "") || "0") * 137) % 1000) / 1000;
            const point = pathEl.getPointAtLength(t * len);
            d3.select(this).attr("cx", point.x).attr("cy", point.y);
          } catch {
            // path not ready
          }
        }
      });
      requestAnimationFrame(animateParticles);
    };
    const animFrame = requestAnimationFrame(animateParticles);

    simulation.on("tick", () => {
      linkPaths.attr("d", linkPath);
      linkHitAreas.attr("d", linkPath);
      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    simulationRef.current = simulation;

    // Hover effects
    nodeElements
      .on("mouseenter", function (_event, d) {
        if (d.type === "hub") return;
        d3.select(this).raise();
        d3.select(this)
          .transition()
          .duration(200)
          .attr("transform", `translate(${d.x},${d.y}) scale(1.12)`);

        // Notify project hover
        if (d.type === "project" && onProjectHoverRef.current) {
          onProjectHoverRef.current(d.id);
        }

        // Notify member hover
        if (d.type === "member" && onMemberHoverRef.current) {
          onMemberHoverRef.current(d.id);
        }

        const connected = links.filter(
          (l) => l.memberId === d.id || l.projectId === d.id
        );
        const connIds = new Set<string>();
        connIds.add(d.id);
        connected.forEach((l) => {
          connIds.add(l.memberId);
          connIds.add(l.projectId);
        });

        if (!highlightId) {
          nodeElements
            .transition()
            .duration(200)
            .attr("opacity", (n) =>
              connIds.has(n.id) || n.type === "hub" ? 1 : 0.12
            );
          linkPaths
            .transition()
            .duration(200)
            .attr("stroke-opacity", (l: GraphLink) =>
              connected.some((c) => c.id === l.id) ? 0.85 : 0.03
            )
            .attr("stroke-width", (l: GraphLink) =>
              connected.some((c) => c.id === l.id) ? 3 : 2
            );
        }
      })
      .on("mouseleave", function (_event, d) {
        if (d.type === "hub") return;
        d3.select(this)
          .transition()
          .duration(200)
          .attr("transform", `translate(${d.x},${d.y}) scale(1)`);

        // Clear project hover
        if (d.type === "project" && onProjectHoverRef.current) {
          onProjectHoverRef.current(null);
        }

        // Clear member hover
        if (d.type === "member" && onMemberHoverRef.current) {
          onMemberHoverRef.current(null);
        }

        if (!highlightId) {
          nodeElements.transition().duration(200).attr("opacity", 1);
          linkPaths
            .transition()
            .duration(200)
            .attr("stroke-opacity", 0.5)
            .attr("stroke-width", 2);
        }
      });

    return () => {
      simulation.stop();
      cancelAnimationFrame(animFrame);
    };
  }, [state, cardsState, dimensions, buildGraphData, highlightMember, highlightProject, filterRole, removeAssignmentByLink, updateTeamMember]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
