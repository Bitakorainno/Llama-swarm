export type BuiltinAgentProfileId = 'developer' | 'orchestrator' | 'planner';

export type AgentProfileId = BuiltinAgentProfileId | (string & {});

export interface AgentProfile {
	allowedTools: string[];
	description: string;
	id: AgentProfileId;
	isCustom?: boolean;
	label: string;
	systemPrompt: string;
	/** id de AGENT_PROFILE_ICONS; desconocido se descarta al leer */
	icon?: string;
	/** id de AGENT_PROFILE_COLORS; desconocido se descarta al leer */
	color?: string;
}
