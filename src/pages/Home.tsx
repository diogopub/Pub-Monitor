/**
 * Home — Página "Painel" do PUB Network Monitor
 */
import { type MemberRole } from "@/contexts/NetworkContext";
import NetworkGraph from "@/components/NetworkGraph";
import SidePanel from "@/components/SidePanel";
import TopBar from "@/components/TopBar";
import WorkloadBar from "@/components/WorkloadBar";
import ScheduleFooter from "@/components/ScheduleFooter";
import { useState } from "react";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028612259/UjaCmpGqyhqDfLGyHgXxbB/pub-hero-bg-PtgN7HuB5WRginXUZ8sr6S.webp";

export default function Home() {
  const [sideCollapsed, setSideCollapsed] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<
    "member" | "project" | null
  >(null);
  const [filterRole, setFilterRole] = useState<MemberRole | "all">("all");
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);

  const handleNodeClick = (
    nodeId: string,
    nodeType: "member" | "project" | "hub"
  ) => {
    if (nodeType === "hub") return;
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
    } else {
      setSelectedNodeId(nodeId);
      setSelectedNodeType(nodeType);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar filterRole={filterRole} onFilterChange={setFilterRole} />
      <div className="flex-1 flex overflow-hidden">
        <SidePanel
          collapsed={sideCollapsed}
          onToggle={() => setSideCollapsed(!sideCollapsed)}
          selectedNodeId={selectedNodeId}
          selectedNodeType={selectedNodeType}
          onClearSelection={() => {
            setSelectedNodeId(null);
            setSelectedNodeType(null);
          }}
        />
        <div
          className="flex-1 relative"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[#080d1a]/65" />
          <div className="absolute inset-0">
            <NetworkGraph
              onNodeClick={handleNodeClick}
              onProjectHover={setHoveredProjectId}
              onMemberHover={setHoveredMemberId}
              highlightMember={
                selectedNodeType === "member" ? selectedNodeId : null
              }
              highlightProject={
                selectedNodeType === "project" ? selectedNodeId : null
              }
              filterRole={filterRole}
            />
          </div>
          <WorkloadBar />
          <ScheduleFooter 
            hoveredProjectId={hoveredProjectId} 
            selectedProjectId={selectedNodeType === "project" ? selectedNodeId : null}
            highlightMemberId={hoveredMemberId} 
          />
        </div>
      </div>
    </div>
  );
}
