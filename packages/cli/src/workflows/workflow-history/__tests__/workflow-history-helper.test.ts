import { GlobalConfig } from '@n8n/config';
import { Container } from '@n8n/di';

import { getWorkflowHistoryPruneTime } from '@/workflows/workflow-history/workflow-history-helper';

const globalConfig = Container.get(GlobalConfig);

beforeEach(() => {
	globalConfig.workflowHistory.pruneTime = -1;
});

describe('getWorkflowHistoryPruneTime', () => {
	test('should return -1 (infinite) if config is -1', () => {
		globalConfig.workflowHistory.pruneTime = -1;

		expect(getWorkflowHistoryPruneTime()).toBe(-1);
	});

	test('should return config time', () => {
		globalConfig.workflowHistory.pruneTime = 24;

		expect(getWorkflowHistoryPruneTime()).toBe(24);
	});
});
