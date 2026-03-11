/**
 * NetworkGraph — D3.js force-directed network visualization
 * Design: "Constellation" — dark elegant with depth, glowing nodes
 * Features: curved links, project cards with role slots, animated particles, hover highlights
 */
import { useNetwork, type MemberRole, ROLE_LABELS } from "@/contexts/NetworkContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

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
}

interface NetworkGraphProps {
  onNodeClick?: (nodeId: string, nodeType: "member" | "project" | "hub") => void;
  onProjectHover?: (projectId: string | null) => void;
  onMemberHover?: (memberId: string | null) => void;
  highlightMember?: string | null;
  highlightProject?: string | null;
  filterRole?: MemberRole | "all";
}

export default function NetworkGraph({
  onNodeClick,
  onProjectHover,
  onMemberHover,
  highlightMember,
  highlightProject,
  filterRole = "all",
}: NetworkGraphProps) {
  const { state, removeAssignmentByLink } = useNetwork();
  const { state: cardsState, updateTeamMember } = useProjectCards();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const onProjectHoverRef = useRef(onProjectHover);
  onProjectHoverRef.current = onProjectHover;
  const onMemberHoverRef = useRef(onMemberHover);
  onMemberHoverRef.current = onMemberHover;
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

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

    // Filter members from NetworkContext
    const filteredMembers =
      filterRole === "all"
        ? state.members
        : state.members.filter((m) => m.role === filterRole);

    filteredMembers.forEach((m) => {
      nodes.push({
        id: m.id,
        label: m.name.toUpperCase(),
        type: "member",
        color: m.color,
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

    const memberIds = new Set(filteredMembers.map((m) => m.id));
    const addedLinkIds = new Set<string>();

    // Build projects and assignments from ProjectCards (only active)
    cardsState.cards.filter((card) => card.active !== false).forEach((card) => {
      // Build assignments: match card team members to network members by name
      const projectAssignments: { memberId: string; role: MemberRole; color: string; name: string; cardTeamMemberId: string; cardId: string }[] = [];

      card.team.forEach((tm) => {
        if (!tm.name || tm.name.trim() === "") return; // skip empty names
        const networkMember = filteredMembers.find(
          (m) => m.name.toLowerCase() === tm.name.toLowerCase()
        );
        if (networkMember) {
          const mappedRole = roleMap[tm.role] || "creative";
          projectAssignments.push({
            memberId: networkMember.id,
            role: mappedRole,
            color: networkMember.color,
            name: networkMember.name,
            cardTeamMemberId: tm.id,
            cardId: card.id,
          });
        }
      });

      // Only add project if it has at least one visible member connected
      if (projectAssignments.length > 0 || filterRole === "all") {
        const slots = projectAssignments.map((a) => ({
          role: a.role,
          color: a.color,
          name: a.name,
        }));

        nodes.push({
          id: card.id,
          label: card.name,
          type: "project",
          color: "#64748b",
          radius: 44,
          status: "active",
          memberSlots: slots,
          isMissingDates: !card.entryDate || !card.deliveryDate,
        });

        projectAssignments.forEach((a) => {
          const linkId = `${a.memberId}-${card.id}`;
          if (!addedLinkIds.has(linkId)) {
            addedLinkIds.add(linkId);
            links.push({
              id: linkId,
              source: a.memberId,
              target: card.id,
              color: a.color,
              memberId: a.memberId,
              projectId: card.id,
              cardTeamMemberId: a.cardTeamMemberId,
              cardId: a.cardId,
            });
          }
        });
      }
    });

    // Also add links from NetworkContext assignments (created via SidePanel Conexões)
    state.assignments.forEach((a) => {
      const linkId = `${a.memberId}-${a.projectId}`;
      if (addedLinkIds.has(linkId)) return; // already added from card data
      if (!memberIds.has(a.memberId)) return; // member is filtered out

      const member = filteredMembers.find((m) => m.id === a.memberId);
      if (!member) return;

      // Ensure project node exists
      const projectExists = nodes.some((n) => n.id === a.projectId);
      if (!projectExists) {
        // Try to find card data for label
        const card = cardsState.cards.find((c) => c.id === a.projectId);
        const proj = state.projects.find((p) => p.id === a.projectId);
        const label = card?.name || proj?.name || "Projeto";
        nodes.push({
          id: a.projectId,
          label,
          type: "project",
          color: "#64748b",
          radius: 44,
          status: "active",
          memberSlots: [{ role: a.role, color: member.color, name: member.name }],
          isMissingDates: card ? (!card.entryDate || !card.deliveryDate) : false,
        });
      } else {
        // Add slot to existing project node
        const projNode = nodes.find((n) => n.id === a.projectId);
        if (projNode && projNode.memberSlots) {
          projNode.memberSlots.push({ role: a.role, color: member.color, name: member.name });
        }
      }

      addedLinkIds.add(linkId);
      links.push({
        id: linkId,
        source: a.memberId,
        target: a.projectId,
        color: member.color,
        memberId: a.memberId,
        projectId: a.projectId,
      });
    });

    return { nodes, links };
  }, [state, cardsState, filterRole]);

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

    // Delete button group (hidden by default)
    const deleteButtons = linkElements
      .append("g")
      .attr("class", "delete-btn")
      .attr("opacity", 0)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        _event.stopPropagation();
        // Clear the team member name in the project card
        if (d.cardTeamMemberId && d.cardId) {
          updateTeamMember(d.cardId, d.cardTeamMemberId, "");
        }
        removeAssignmentByLink(d.memberId, d.projectId);
      });

    deleteButtons
      .append("circle")
      .attr("r", 9)
      .attr("fill", "rgba(220, 38, 38, 0.9)")
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-width", 1);

    deleteButtons
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#ffffff")
      .attr("font-size", "13px")
      .attr("font-weight", "700")
      .attr("font-family", "Sora, sans-serif")
      .text("−");

    // Hover: show/hide delete button
    linkElements
      .on("mouseenter", function () {
        d3.select(this).select(".delete-btn")
          .transition().duration(150).attr("opacity", 1);
        d3.select(this).select(".link-path")
          .transition().duration(150).attr("stroke-width", 4).attr("stroke-opacity", 0.9);
      })
      .on("mouseleave", function () {
        d3.select(this).select(".delete-btn")
          .transition().duration(150).attr("opacity", 0);
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

    // ─── Draw PROJECT nodes (cards with role slots) ───
    nodeElements
      .filter((d) => d.type === "project")
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

        // Project name
        el.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", d.memberSlots && d.memberSlots.length > 0 ? "-0.4em" : "0.1em")
          .attr("fill", "#e2e8f0")
          .attr("font-size", d.label.length > 10 ? "9px" : "11px")
          .attr("font-weight", "700")
          .attr("font-family", "Sora, sans-serif")
          .attr("letter-spacing", "0.06em")
          .text(d.label);

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

    // Curved link path generator
    const linkPath = (d: GraphLink) => {
      const s = d.source as GraphNode;
      const t = d.target as GraphNode;
      const dx = t.x! - s.x!;
      const dy = t.y! - s.y!;
      const dr = Math.sqrt(dx * dx + dy * dy) * 0.8;
      return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
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
      // Position delete button on the actual curved path
      deleteButtons.each(function (d: GraphLink) {
        const pathEl = linkPaths
          .filter((l: GraphLink) => l.id === d.id)
          .node() as SVGPathElement | null;
        if (pathEl) {
          try {
            const len = pathEl.getTotalLength();
            const point = pathEl.getPointAtLength(len * 0.5);
            d3.select(this).attr("transform", `translate(${point.x},${point.y})`);
          } catch {
            // path not ready
          }
        }
      });
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
