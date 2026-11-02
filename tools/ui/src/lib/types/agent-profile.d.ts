export type AgentProfileId = 'developer' | 'orchestrator' | 'planner';

export interface AgentProfile {
	allowedTools: string[];
	description: string;
	id: AgentProfileId;
	label: string;
	systemPrompt: string;
}
