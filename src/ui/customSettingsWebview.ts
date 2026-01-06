/**
 * Generate the HTML content for the custom settings selection + record selection webview.
 *
 * Step 1: Select custom setting types.
 * Step 2: Click Retrieve to load records; select records in a tree and save/retrieve.
 */
export function getWebviewContent(customSettings: string[], existingSettings: string[]): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Select Custom Settings</title>
	<style>
		:root {
			--border: 1px solid var(--vscode-panel-border);
		}
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			padding: 16px;
			margin: 0;
		}
		h1 {
			font-size: 20px;
			font-weight: 600;
			margin: 0 0 10px;
		}
		.description {
			color: var(--vscode-descriptionForeground);
			margin-bottom: 14px;
			font-size: 13px;
		}
		.split {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
			align-items: start;
		}
		@media (max-width: 900px) {
			.split { grid-template-columns: 1fr; }
		}
		.column {
			border: var(--border);
			border-radius: 6px;
			padding: 12px;
			background: var(--vscode-sideBar-background);
		}
		.column h2 {
			font-size: 14px;
			margin: 0 0 10px;
			font-weight: 600;
		}
		.search-container { margin-bottom: 10px; }
		.search-input {
			width: 100%;
			padding: 8px 10px;
			font-size: 13px;
			font-family: var(--vscode-font-family);
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			box-sizing: border-box;
		}
		.settings-container {
			display: flex;
			flex-direction: column;
			gap: 6px;
			max-height: 55vh;
			overflow: auto;
			padding-right: 4px;
		}
		.setting-item {
			display: flex;
			align-items: center;
			padding: 6px 10px;
			background-color: var(--vscode-list-inactiveSelectionBackground);
			border-radius: 4px;
			cursor: pointer;
			transition: background-color 0.1s;
		}
		.setting-item:hover { background-color: var(--vscode-list-hoverBackground); }
		.setting-item input[type="checkbox"] {
			margin-right: 10px;
			cursor: pointer;
			width: 16px;
			height: 16px;
		}
		.setting-item label { cursor: pointer; flex: 1; font-size: 13px; }
		.setting-item.already-selected { opacity: 0.65; }
		.setting-item.already-selected label::after {
			content: " (already added)";
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}

		.button-row {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			margin-top: 12px;
			align-items: center;
		}
		button {
			padding: 8px 14px;
			font-size: 13px;
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-family: var(--vscode-font-family);
		}
		.primary-button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); }
		.primary-button:hover { background-color: var(--vscode-button-hoverBackground); }
		.primary-button:disabled { opacity: 0.5; cursor: not-allowed; }
		.secondary-button { background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
		.secondary-button:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
		.selection-info { color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px; }

		/* Tree */
		.tree {
			max-height: 65vh;
			overflow: auto;
			padding-right: 4px;
		}
		.tree ul { list-style: none; padding-left: 16px; margin: 6px 0; }
		.tree li { margin: 4px 0; }
		.tree .node {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 4px 6px;
			border-radius: 4px;
		}
		.tree .node:hover { background: var(--vscode-list-hoverBackground); }
		.small {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.mono { font-family: var(--vscode-editor-font-family); }
		.pill {
			border: 1px solid var(--vscode-input-border);
			border-radius: 999px;
			padding: 1px 8px;
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}
		.loading {
			display: none;
			margin-top: 8px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.loading.visible { display: block; }
	</style>
</head>
<body>
	<h1>Custom Settings</h1>
	<p class="description">
		1) Select Custom Setting types. 2) Click Retrieve to load records. 3) Select records and save/retrieve.
	</p>

	<div class="split">
		<div class="column">
			<h2>1) Types</h2>
			<div class="search-container">
				<input type="text" id="searchInput" class="search-input" placeholder="Search custom settings..." />
			</div>
			<div class="settings-container" id="settingsContainer">
				${customSettings
					.map(setting => {
						const isExisting = existingSettings.includes(setting);
						return `
						<div class="setting-item ${isExisting ? 'already-selected' : ''}">
							<input type="checkbox" id="type-${setting}" value="${setting}" ${isExisting ? 'checked' : ''}>
							<label for="type-${setting}">${setting}</label>
						</div>
						`;
					})
					.join('')}
			</div>
			<div class="selection-info" id="typesSelectionInfo">0 types selected</div>
			<div class="button-row">
				<button class="primary-button" id="retrieveButton" onclick="retrieveTypes()">Retrieve</button>
				<button class="secondary-button" onclick="selectAllTypes()">Select All</button>
				<button class="secondary-button" onclick="deselectAllTypes()">Deselect All</button>
			</div>
			<div class="loading" id="typesLoading">Loading records for selected types...</div>
		</div>

		<div class="column">
			<h2>2) Records</h2>
			<div class="small">Select individual records. Labels show <span class="mono">Name</span> when available; hierarchy settings may show <span class="mono">SetupOwnerId</span>. Selections are saved by a stable key (prefer <span class="mono">Name</span>, fallback to <span class="mono">SetupOwnerId</span>).</div>
			<div class="selection-info" id="recordsSelectionInfo">0 records selected</div>
			<div class="button-row">
				<button class="primary-button" id="saveAndRetrieveButton" onclick="saveAndRetrieve()" disabled>Save + Retrieve Selected Records</button>
				<button class="secondary-button" id="saveTypesOnlyButton" onclick="saveTypesOnly()" disabled>Save Types Only</button>
			</div>
			<div class="loading" id="recordsLoading">Waiting for Retrieve...</div>
			<div class="tree" id="recordsTree"></div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		let loadedRecordsByType = {}; // { [type: string]: Array<{Id, Name?, SetupOwnerId?}> }

		function getSelectedTypes() {
			const checkboxes = document.querySelectorAll('#settingsContainer input[type="checkbox"]:checked');
			return Array.from(checkboxes).map(cb => cb.value);
		}

		function updateTypesSelectionInfo() {
			const count = getSelectedTypes().length;
			document.getElementById('typesSelectionInfo').textContent = count === 1 ? '1 type selected' : count + ' types selected';
			document.getElementById('retrieveButton').disabled = count === 0;
			document.getElementById('saveTypesOnlyButton').disabled = count === 0;
		}

		function selectAllTypes() {
			const checkboxes = document.querySelectorAll('.setting-item:not([style*="display: none"]) input[type="checkbox"]');
			checkboxes.forEach(cb => (cb.checked = true));
			updateTypesSelectionInfo();
		}

		function deselectAllTypes() {
			const checkboxes = document.querySelectorAll('#settingsContainer input[type="checkbox"]');
			checkboxes.forEach(cb => (cb.checked = false));
			updateTypesSelectionInfo();
		}

		function setLoading(id, visible, text) {
			const el = document.getElementById(id);
			if (!el) return;
			if (typeof text === 'string') el.textContent = text;
			el.classList.toggle('visible', !!visible);
		}

		function retrieveTypes() {
			const types = getSelectedTypes();
			if (types.length === 0) return;

			setLoading('typesLoading', true);
			setLoading('recordsLoading', true, 'Loading...');
			document.getElementById('recordsTree').innerHTML = '';
			loadedRecordsByType = {};
			updateRecordsSelectionInfo();
			document.getElementById('saveAndRetrieveButton').disabled = true;

			vscode.postMessage({ command: 'fetchRecords', types });
		}

		function saveTypesOnly() {
			const types = getSelectedTypes();
			if (types.length === 0) return;
			vscode.postMessage({ command: 'saveSettings', settings: types });
		}

		function recordLabel(rec) {
			if (rec && typeof rec.Name === 'string' && rec.Name.trim().length > 0) return rec.Name;
			if (rec && typeof rec.SetupOwnerId === 'string' && rec.SetupOwnerId.trim().length > 0) return rec.SetupOwnerId;
			return rec && rec.Id ? rec.Id : '(unknown)';
		}

		function renderTree(recordsByType) {
			const container = document.getElementById('recordsTree');
			container.innerHTML = '';

			const types = Object.keys(recordsByType).sort((a, b) => a.localeCompare(b));
			if (types.length === 0) {
				container.innerHTML = '<div class="small">No records returned for selected types.</div>';
				return;
			}

			const ul = document.createElement('ul');
			types.forEach(type => {
				const typeLi = document.createElement('li');

				const typeHeader = document.createElement('div');
				typeHeader.className = 'node';

				const typeCb = document.createElement('input');
				typeCb.type = 'checkbox';
				typeCb.dataset.type = type;
				typeCb.dataset.kind = 'type';

				const typeLabel = document.createElement('span');
				typeLabel.textContent = type;

				const pill = document.createElement('span');
				pill.className = 'pill';
				pill.textContent = String((recordsByType[type] || []).length);

				typeHeader.appendChild(typeCb);
				typeHeader.appendChild(typeLabel);
				typeHeader.appendChild(pill);
				typeLi.appendChild(typeHeader);

				const recordsUl = document.createElement('ul');
				(recordsByType[type] || []).forEach(rec => {
					const recLi = document.createElement('li');
					const recNode = document.createElement('div');
					recNode.className = 'node';

					const recCb = document.createElement('input');
					recCb.type = 'checkbox';
					recCb.dataset.kind = 'record';
					recCb.dataset.type = type;
					recCb.dataset.key = recordLabel(rec);

					const recText = document.createElement('span');
					recText.textContent = recordLabel(rec);

					const recId = document.createElement('span');
					recId.className = 'small mono';
					recId.textContent = rec.Id;

					recNode.appendChild(recCb);
					recNode.appendChild(recText);
					recNode.appendChild(recId);
					recLi.appendChild(recNode);
					recordsUl.appendChild(recLi);
				});
				typeLi.appendChild(recordsUl);

				// type checkbox toggles all children
				typeCb.addEventListener('change', () => {
					const checked = typeCb.checked;
					recordsUl.querySelectorAll('input[data-kind="record"]').forEach(cb => (cb.checked = checked));
					updateRecordsSelectionInfo();
				});

				ul.appendChild(typeLi);
			});

			container.appendChild(ul);

			// hook record checkbox changes
			container.querySelectorAll('input[data-kind="record"]').forEach(cb => {
				cb.addEventListener('change', updateRecordsSelectionInfo);
			});
		}

		function getSelectedRecords() {
			const selected = {};
			document.querySelectorAll('#recordsTree input[data-kind="record"]:checked').forEach(cb => {
				const type = cb.dataset.type;
				const key = cb.dataset.key;
				if (!type || !key) return;
				selected[type] = selected[type] || [];
				selected[type].push(key);
			});

			return Object.keys(selected)
				.sort((a, b) => a.localeCompare(b))
				.map(type => ({ type, recordIds: selected[type].sort() }));
		}

		function updateRecordsSelectionInfo() {
			const records = getSelectedRecords();
			const count = records.reduce((sum, r) => sum + r.recordIds.length, 0);
			document.getElementById('recordsSelectionInfo').textContent = count === 1 ? '1 record selected' : count + ' records selected';
			document.getElementById('saveAndRetrieveButton').disabled = count === 0;
		}

		function saveAndRetrieve() {
			const records = getSelectedRecords();
			if (records.length === 0) return;
			vscode.postMessage({ command: 'retrieveSelectedRecords', records });
		}

		// Search functionality
		const searchInput = document.getElementById('searchInput');
		searchInput.addEventListener('input', (e) => {
			const searchTerm = (e.target.value || '').toLowerCase();
			document.querySelectorAll('.setting-item').forEach(item => {
				const label = item.querySelector('label');
				const settingName = (label ? label.textContent : '').toLowerCase();
				item.style.display = settingName.includes(searchTerm) ? 'flex' : 'none';
			});
		});
		searchInput.focus();

		// Toggle by clicking row
		document.querySelectorAll('.setting-item').forEach(item => {
			item.addEventListener('click', (e) => {
				if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
					const checkbox = item.querySelector('input[type="checkbox"]');
					checkbox.checked = !checkbox.checked;
					updateTypesSelectionInfo();
				}
			});
		});
		document.querySelectorAll('#settingsContainer input[type="checkbox"]').forEach(cb => cb.addEventListener('change', updateTypesSelectionInfo));
		updateTypesSelectionInfo();

		window.addEventListener('message', event => {
			const message = event.data;
			if (!message || !message.command) return;

			if (message.command === 'displayRecords') {
				setLoading('typesLoading', false);
				setLoading('recordsLoading', false);
				loadedRecordsByType = message.records || {};
				renderTree(loadedRecordsByType);
				updateRecordsSelectionInfo();
			}
		});
	</script>
</body>
</html>`;
}
