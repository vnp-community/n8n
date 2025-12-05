<script setup lang="ts">
import type { ViewUpdate } from '@codemirror/view';
import type { CodeExecutionMode, CodeNodeEditorLanguage } from 'n8n-workflow';
import { format } from 'prettier';
import jsParser from 'prettier/plugins/babel';
import * as estree from 'prettier/plugins/estree';
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';

import { CODE_NODE_TYPE } from '@/app/constants';
import { codeNodeEditorEventBus } from '@/app/event-bus';
import { useRootStore } from '@n8n/stores/useRootStore';

import { useCodeEditor } from '../../composables/useCodeEditor';
import { useI18n } from '@n8n/i18n';
import { useMessage } from '@/app/composables/useMessage';
import { useTelemetry } from '@/app/composables/useTelemetry';
import AskAI from './AskAI/AskAI.vue';
import { CODE_PLACEHOLDERS } from './constants';
import { useLinter } from './linter';
import { useSettingsStore } from '@/app/stores/settings.store';
import { dropInCodeEditor } from '../../plugins/codemirror/dragAndDrop';
import type { TargetNodeParameterContext } from '@/Interface';
import { valueToInsert } from './utils';
import DraggableTarget from '@/app/components/DraggableTarget.vue';

import { ElTabPane, ElTabs } from 'element-plus';
export type CodeNodeLanguageOption = CodeNodeEditorLanguage | 'pythonNative';

type Props = {
	mode: CodeExecutionMode;
	modelValue: string;
	aiButtonEnabled?: boolean;
	fillParent?: boolean;
	language?: CodeNodeLanguageOption;
	isReadOnly?: boolean;
	rows?: number;
	id?: string;
	targetNodeParameterContext?: TargetNodeParameterContext;
	disableAskAi?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
	aiButtonEnabled: false,
	fillParent: false,
	language: 'javaScript',
	isReadOnly: false,
	rows: 4,
	id: () => crypto.randomUUID(),
	targetNodeParameterContext: undefined,
	disableAskAi: false,
});
const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();

const message = useMessage();
const tabs = ref(['code', 'ask-ai']);
const activeTab = ref('code');
const isLoadingAIResponse = ref(false);
const codeNodeEditorRef = ref<HTMLDivElement>();
const codeNodeEditorContainerRef = ref<HTMLDivElement>();
const hasManualChanges = ref(false);

const rootStore = useRootStore();
const i18n = useI18n();
const telemetry = useTelemetry();
const settingsStore = useSettingsStore();

const linter = useLinter(
	() => props.mode,
	() => (props.language === 'pythonNative' ? 'python' : props.language),
);
const extensions = computed(() => [linter.value]);
const placeholder = computed(() => CODE_PLACEHOLDERS[props.language]?.[props.mode] ?? '');
const dragAndDropEnabled = computed(() => {
	return !props.isReadOnly;
});

const { highlightLine, readEditorValue, editor, focus } = useCodeEditor({
	id: props.id,
	editorRef: codeNodeEditorRef,
	language: () => props.language,
	languageParams: () => ({ mode: props.mode }),
	editorValue: () => props.modelValue,
	placeholder,
	extensions,
	isReadOnly: () => props.isReadOnly,
	theme: {
		maxHeight: props.fillParent ? '100%' : '40vh',
		minHeight: '20vh',
		rows: props.rows,
	},
	onChange: onEditorUpdate,
	targetNodeParameterContext: () => props.targetNodeParameterContext,
});

onMounted(() => {
	if (!props.isReadOnly) codeNodeEditorEventBus.on('highlightLine', highlightLine);
	codeNodeEditorEventBus.on('codeDiffApplied', diffApplied);

	if (!props.modelValue) {
		emit('update:modelValue', placeholder.value);
	}
});

onBeforeUnmount(() => {
	codeNodeEditorEventBus.off('codeDiffApplied', diffApplied);
	if (!props.isReadOnly) codeNodeEditorEventBus.off('highlightLine', highlightLine);
});

const askAiEnabled = computed(() => {
	return !props.disableAskAi && settingsStore.isAskAiEnabled && props.language === 'javaScript';
});

watch([() => props.language, () => props.mode], (_, [prevLanguage, prevMode]) => {
	if (readEditorValue().trim() === CODE_PLACEHOLDERS[prevLanguage]?.[prevMode]) {
		emit('update:modelValue', placeholder.value);
	}
});

async function onBeforeTabLeave(_activeName: string | number, oldActiveName: string | number) {
	// Confirm dialog if leaving ask-ai tab during loading
	if (oldActiveName === 'ask-ai' && isLoadingAIResponse.value) {
		const confirmModal = await message.alert(i18n.baseText('codeNodeEditor.askAi.sureLeaveTab'), {
			title: i18n.baseText('codeNodeEditor.askAi.areYouSure'),
			confirmButtonText: i18n.baseText('codeNodeEditor.askAi.switchTab'),
			showClose: true,
			showCancelButton: true,
		});

		return confirmModal === 'confirm';
	}

	return true;
}

async function onAiReplaceCode(code: string) {
	// Validate code input FIRST - before any processing
	if (!code || typeof code !== 'string') {
		console.error('[CodeNodeEditor] Invalid code input:', code);
		alert(`Error: Invalid code received. Type: ${typeof code}, Value: ${code}`);
		return;
	}

	console.log('[CodeNodeEditor] onAiReplaceCode called with code:', code);
	console.log('[CodeNodeEditor] Code length:', code?.length);
	console.log('[CodeNodeEditor] Code type:', typeof code);
	console.log('[CodeNodeEditor] Code sample:', code.substring(0, 100));

	// CRITICAL: Check for expressions and potentially unsafe syntax FIRST, before ANY async operations
	// SDK returns raw code without formatting when expressions are present
	// Prettier will try to parse expressions as JavaScript and fail with SyntaxError
	const hasExpressions = /\{\{[\s\S]*?\}\}/.test(code);

	// Check for template literals that might cause parsing issues
	// Template literals like ${var} outside of backticks will cause syntax errors
	const hasTemplateLiterals = /\$\{[^}]*\}/.test(code);

	// Check for template literal syntax that's not properly wrapped in backticks
	// This pattern detects ${...} that appears outside of template strings
	// We check if there are ${} but no matching backticks around them
	const lines = code.split('\n');
	const hasUnsafeTemplateLiteral = lines.some((line) => {
		// Check if line has ${} but is not wrapped in backticks
		if (/\$\{[^}]*\}/.test(line)) {
			// Check if the line is part of a template literal (has backticks)
			const hasBackticks = line.includes('`');
			// If has ${} but no backticks, it's unsafe
			return !hasBackticks;
		}
		return false;
	});

	const hasUnsafeSyntax = hasExpressions || hasTemplateLiterals || hasUnsafeTemplateLiteral;
	console.log('[CodeNodeEditor] Has expressions:', hasExpressions);
	console.log('[CodeNodeEditor] Has template literals:', hasTemplateLiterals);
	console.log('[CodeNodeEditor] Has unsafe template literal syntax:', hasUnsafeTemplateLiteral);
	console.log('[CodeNodeEditor] Has unsafe syntax (skip formatting):', hasUnsafeSyntax);

	// If unsafe syntax is present, skip ALL formatting and return immediately
	if (hasUnsafeSyntax) {
		console.log('[CodeNodeEditor] SKIPPING format due to unsafe syntax - using code as-is');
		console.log('[CodeNodeEditor] Emitting code directly (no formatting)');

		try {
			emit('update:modelValue', code);
			activeTab.value = 'code';
			hasManualChanges.value = false;
			console.log('[CodeNodeEditor] Code with unsafe syntax emitted successfully');
		} catch (error) {
			console.error('[CodeNodeEditor] Error emitting code:', error);
			alert(`Error emitting code: ${error instanceof Error ? error.message : String(error)}`);
		}
		return; // EARLY RETURN - do not proceed to formatting
	}

	// Code passed syntax check, safe to format
	// First, try to validate JavaScript syntax by attempting to parse it
	let isValidJavaScript = true;
	let parseError: Error | null = null;

	try {
		// Try to parse the code to validate it's valid JavaScript
		// Use Function constructor as a simple syntax validator
		// This will throw if code has syntax errors
		new Function(code);
		console.log('[CodeNodeEditor] JavaScript syntax validation passed');
	} catch (validationError) {
		isValidJavaScript = false;
		parseError =
			validationError instanceof Error ? validationError : new Error(String(validationError));
		console.error('[CodeNodeEditor] JavaScript syntax validation failed:', parseError);
	}

	// If code is not valid JavaScript, alert user and use code as-is
	if (!isValidJavaScript && parseError) {
		const errorMessage = parseError.message || 'Invalid JavaScript syntax';
		const codePreview = code.length > 500 ? code.substring(0, 500) + '\n...' : code;

		console.error('[CodeNodeEditor] Invalid JavaScript code detected - alerting user');

		await message.alert(
			`JavaScript Syntax Error:\n\n${errorMessage}\n\nGenerated code:\n\`\`\`javascript\n${codePreview}\n\`\`\`\n\nCode will be inserted as-is. Please review and fix any syntax errors.`,
			{
				title: i18n.baseText('codeNodeEditor.askAi.generationFailed') || 'Code Generation Error',
				confirmButtonText: 'OK',
				showClose: true,
				dangerouslyUseHTMLString: false,
			},
		);

		// Still emit the code so user can see it and fix it
		console.log('[CodeNodeEditor] Emitting invalid code - user can fix it');
		try {
			emit('update:modelValue', code);
			activeTab.value = 'code';
			hasManualChanges.value = false;
			console.log('[CodeNodeEditor] Invalid code emitted successfully');
		} catch (emitError) {
			console.error('[CodeNodeEditor] Error emitting code:', emitError);
		}
		return; // Don't proceed to formatting
	}

	// Code is valid JavaScript, proceed with formatting
	// Wrap in try-catch to handle any syntax errors prettier might encounter
	try {
		console.log('[CodeNodeEditor] No unsafe syntax detected - attempting to format code...');
		const formattedCode = await format(code, {
			parser: 'babel',
			plugins: [jsParser, estree],
		});
		console.log('[CodeNodeEditor] Formatting successful');
		console.log(
			'[CodeNodeEditor] Final formattedCode (first 200 chars):',
			formattedCode.substring(0, 200),
		);

		emit('update:modelValue', formattedCode);
		console.log('[CodeNodeEditor] Successfully emitted formatted code');

		activeTab.value = 'code';
		hasManualChanges.value = false;

		console.log('[CodeNodeEditor] Code replacement completed successfully');
	} catch (error) {
		// If formatting fails (SyntaxError, etc.), validate and alert user
		const isSyntaxError =
			error instanceof SyntaxError ||
			(error instanceof Error && error.name === 'SyntaxError') ||
			(error instanceof Error && error.message.includes('SyntaxError')) ||
			(error instanceof Error && error.message.includes('Unexpected token'));

		if (isSyntaxError) {
			console.error('[CodeNodeEditor] JavaScript syntax error detected during formatting:', error);

			// Extract error message
			const errorMessage = error instanceof Error ? error.message : String(error);
			const codePreview = code.length > 500 ? code.substring(0, 500) + '\n...' : code;

			// Show alert to user with error message and code preview
			await message.alert(
				`JavaScript Syntax Error:\n\n${errorMessage}\n\nGenerated code:\n\`\`\`javascript\n${codePreview}\n\`\`\`\n\nCode will be inserted as-is. Please review and fix any syntax errors.`,
				{
					title: i18n.baseText('codeNodeEditor.askAi.generationFailed') || 'Code Generation Error',
					confirmButtonText: 'OK',
					showClose: true,
					dangerouslyUseHTMLString: false,
				},
			);

			// Still emit the code so user can see it and fix it
			console.log('[CodeNodeEditor] Emitting code despite syntax error - user can fix it');
			try {
				emit('update:modelValue', code);
				activeTab.value = 'code';
				hasManualChanges.value = false;
			} catch (emitError) {
				console.error('[CodeNodeEditor] Error emitting code:', emitError);
			}
		} else {
			// Other formatting errors
			console.warn('[CodeNodeEditor] Formatting failed:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			const codePreview = code.length > 500 ? code.substring(0, 500) + '\n...' : code;

			await message.alert(
				`Code Formatting Error:\n\n${errorMessage}\n\nGenerated code:\n\`\`\`javascript\n${codePreview}\n\`\`\`\n\nCode will be inserted as-is.`,
				{
					title: i18n.baseText('codeNodeEditor.askAi.generationFailed') || 'Code Formatting Error',
					confirmButtonText: 'OK',
					showClose: true,
					dangerouslyUseHTMLString: false,
				},
			);

			// Fallback to original code
			try {
				emit('update:modelValue', code);
				activeTab.value = 'code';
				hasManualChanges.value = false;
				console.log('[CodeNodeEditor] Original code emitted successfully');
			} catch (emitError) {
				console.error('[CodeNodeEditor] Error emitting fallback code:', emitError);
			}
		}
	}
}

function onEditorUpdate(viewUpdate: ViewUpdate) {
	trackCompletion(viewUpdate);
	hasManualChanges.value = true;
	emit('update:modelValue', readEditorValue());
}

function diffApplied() {
	codeNodeEditorContainerRef.value?.classList.add('flash-editor');
	codeNodeEditorContainerRef.value?.addEventListener('animationend', () => {
		codeNodeEditorContainerRef.value?.classList.remove('flash-editor');
	});
}

function trackCompletion(viewUpdate: ViewUpdate) {
	const completionTx = viewUpdate.transactions.find((tx) => tx.isUserEvent('input.complete'));

	if (!completionTx) return;

	try {
		// @ts-expect-error - undocumented fields
		const { fromA, toB } = viewUpdate?.changedRanges[0];
		const full = viewUpdate.state.doc.slice(fromA, toB).toString();
		const lastDotIndex = full.lastIndexOf('.');

		let context = null;
		let insertedText = null;

		if (lastDotIndex === -1) {
			context = '';
			insertedText = full;
		} else {
			context = full.slice(0, lastDotIndex);
			insertedText = full.slice(lastDotIndex + 1);
		}

		// TODO: Still has to get updated for Python and JSON
		telemetry.track('User autocompleted code', {
			instance_id: rootStore.instanceId,
			node_type: CODE_NODE_TYPE,
			field_name: props.mode === 'runOnceForAllItems' ? 'jsCodeAllItems' : 'jsCodeEachItem',
			field_type: 'code',
			context,
			inserted_text: insertedText,
		});
	} catch {}
}

function onAiLoadStart() {
	isLoadingAIResponse.value = true;
}

function onAiLoadEnd() {
	isLoadingAIResponse.value = false;
}

async function onDrop(value: string, event: MouseEvent) {
	if (!editor.value) return;

	await dropInCodeEditor(
		toRaw(editor.value),
		event,
		valueToInsert(value, props.language, props.mode),
	);
}

defineExpose({
	focus,
});
</script>

<template>
	<div
		ref="codeNodeEditorContainerRef"
		:class="['code-node-editor', $style['code-node-editor-container']]"
	>
		<ElTabs
			v-if="askAiEnabled"
			ref="tabs"
			v-model="activeTab"
			type="card"
			:before-leave="onBeforeTabLeave"
			:class="$style.tabs"
		>
			<ElTabPane
				:label="i18n.baseText('codeNodeEditor.tabs.code')"
				name="code"
				data-test-id="code-node-tab-code"
				:class="$style.fillHeight"
			>
				<DraggableTarget
					type="mapping"
					:disabled="!dragAndDropEnabled"
					:class="$style.fillHeight"
					@drop="onDrop"
				>
					<template #default="{ activeDrop, droppable }">
						<div
							ref="codeNodeEditorRef"
							:class="[
								'ph-no-capture',
								'code-editor-tabs',
								$style.editorInput,
								$style.fillHeight,
								{ [$style.activeDrop]: activeDrop, [$style.droppable]: droppable },
							]"
						/>
					</template>
				</DraggableTarget>
				<slot name="suffix" />
			</ElTabPane>
			<ElTabPane
				:label="i18n.baseText('codeNodeEditor.tabs.askAi')"
				name="ask-ai"
				data-test-id="code-node-tab-ai"
			>
				<!-- Key the AskAI tab to make sure it re-mounts when changing tabs -->
				<AskAI
					:key="activeTab"
					:has-changes="hasManualChanges"
					:is-read-only="props.isReadOnly"
					@replace-code="onAiReplaceCode"
					@started-loading="onAiLoadStart"
					@finished-loading="onAiLoadEnd"
				/>
			</ElTabPane>
		</ElTabs>
		<!-- If AskAi not enabled, there's no point in rendering tabs -->
		<div v-else :class="$style.fillHeight">
			<DraggableTarget
				type="mapping"
				:disabled="!dragAndDropEnabled"
				:class="$style.fillHeight"
				@drop="onDrop"
			>
				<template #default="{ activeDrop, droppable }">
					<div
						ref="codeNodeEditorRef"
						:class="[
							'ph-no-capture',
							$style.fillHeight,
							$style.editorInput,
							{ [$style.activeDrop]: activeDrop, [$style.droppable]: droppable },
						]"
					/>
				</template>
			</DraggableTarget>
			<slot name="suffix" />
		</div>
	</div>
</template>

<style scoped lang="scss">
:deep(.el-tabs) {
	.cm-editor {
		border: 0;
	}
}

@keyframes backgroundAnimation {
	0% {
		background-color: none;
	}
	30% {
		background-color: rgba(41, 163, 102, 0.1);
	}
	100% {
		background-color: none;
	}
}

.flash-editor {
	:deep(.cm-editor),
	:deep(.cm-gutter) {
		animation: backgroundAnimation 1.5s ease-in-out;
	}
}
</style>

<style lang="scss" module>
.tabs {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.code-node-editor-container {
	position: relative;
}

.fillHeight {
	height: 100%;
}

.editorInput.droppable {
	:global(.cm-editor) {
		border-color: var(--ndv--droppable-parameter--color);
		border-style: dashed;
		border-width: 1.5px;
	}
}

.editorInput.activeDrop {
	:global(.cm-editor) {
		border-color: var(--color--success);
		border-style: solid;
		cursor: grabbing;
		border-width: 1px;
	}
}
</style>
