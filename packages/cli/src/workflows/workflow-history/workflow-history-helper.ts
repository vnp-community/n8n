import { GlobalConfig } from '@n8n/config';
import { Container } from '@n8n/di';

export function getWorkflowHistoryLicensePruneTime() {
	return -1;
}

// Time in hours
export function getWorkflowHistoryPruneTime(): number {
	return Container.get(GlobalConfig).workflowHistory.pruneTime;
}
