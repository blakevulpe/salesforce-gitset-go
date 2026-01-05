/**
 * Generate the HTML content for the custom settings selection webview
 */
export function getWebviewContent(customSettings: string[], existingSettings: string[]): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Select Custom Settings</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			padding: 20px;
			margin: 0;
		}
		h1 {
			font-size: 24px;
			font-weight: 600;
			margin-bottom: 10px;
		}
		.description {
			color: var(--vscode-descriptionForeground);
			margin-bottom: 20px;
			font-size: 13px;
		}
		.search-container {
			margin-bottom: 15px;
		}
		.search-input {
			width: 100%;
			padding: 8px 12px;
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
			gap: 8px;
			margin-bottom: 20px;
		}
		.setting-item {
			display: flex;
			align-items: center;
			padding: 8px 12px;
			background-color: var(--vscode-list-inactiveSelectionBackground);
			border-radius: 4px;
			cursor: pointer;
			transition: background-color 0.1s;
		}
		.setting-item:hover {
			background-color: var(--vscode-list-hoverBackground);
		}
		.setting-item input[type="checkbox"] {
			margin-right: 10px;
			cursor: pointer;
			width: 16px;
			height: 16px;
		}
		.setting-item label {
			cursor: pointer;
			flex: 1;
			font-size: 13px;
		}
		.setting-item.already-selected {
			opacity: 0.6;
		}
		.setting-item.already-selected label::after {
			content: " (already added)";
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}
		.button-container {
			display: flex;
			gap: 10px;
			margin-top: 20px;
		}
		button {
			padding: 8px 16px;
			font-size: 13px;
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-family: var(--vscode-font-family);
		}
		.primary-button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.primary-button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		.primary-button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.secondary-button {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.secondary-button:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		.selection-info {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			margin-top: 10px;
		}
	</style>
</head>
<body>
	<h1>Select Custom Settings</h1>
	<p class="description">
		Choose one or more custom settings to add to your custom-settings.yaml file.
		Settings already in the file are marked and can be skipped.
	</p>
	
	<div class="search-container">
		<input
			type="text"
			id="searchInput"
			class="search-input"
			placeholder="Search custom settings..."
		/>
	</div>
	
	<div class="settings-container" id="settingsContainer">
		${customSettings.map(setting => {
			const isExisting = existingSettings.includes(setting);
			return `
			<div class="setting-item ${isExisting ? 'already-selected' : ''}">
				<input type="checkbox" id="${setting}" value="${setting}" ${isExisting ? 'checked' : ''}>
				<label for="${setting}">${setting}</label>
			</div>
			`;
		}).join('')}
	</div>
	
	<div class="selection-info" id="selectionInfo">
		0 settings selected
	</div>
	
	<div class="button-container">
		<button class="primary-button" id="saveButton" onclick="saveSettings()">
			Add Selected Settings
		</button>
		<button class="secondary-button" onclick="selectAll()">
			Select All
		</button>
		<button class="secondary-button" onclick="deselectAll()">
			Deselect All
		</button>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		function updateSelectionInfo() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
			const count = checkboxes.length;
			const info = document.getElementById('selectionInfo');
			const saveButton = document.getElementById('saveButton');
			
			info.textContent = count === 1 ? '1 setting selected' : count + ' settings selected';
			saveButton.disabled = count === 0;
		}
		
		function selectAll() {
			const checkboxes = document.querySelectorAll('.setting-item:not([style*="display: none"]) input[type="checkbox"]');
			checkboxes.forEach(cb => cb.checked = true);
			updateSelectionInfo();
		}
		
		function deselectAll() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]');
			checkboxes.forEach(cb => cb.checked = false);
			updateSelectionInfo();
		}
		
		function saveSettings() {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
			const selectedSettings = Array.from(checkboxes).map(cb => cb.value);
			
			if (selectedSettings.length === 0) {
				return;
			}
			
			vscode.postMessage({
				command: 'saveSettings',
				settings: selectedSettings
			});
		}
		
		// Initialize selection info on load
		updateSelectionInfo();
		
		// Allow clicking on the setting item to toggle checkbox
		document.querySelectorAll('.setting-item').forEach(item => {
			item.addEventListener('click', (e) => {
				if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
					const checkbox = item.querySelector('input[type="checkbox"]');
					checkbox.checked = !checkbox.checked;
					updateSelectionInfo();
				}
			});
		});
		
		// Update selection info when checkboxes change
		document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
			cb.addEventListener('change', updateSelectionInfo);
		});
		
		// Search functionality
		const searchInput = document.getElementById('searchInput');
		searchInput.addEventListener('input', (e) => {
			const searchTerm = e.target.value.toLowerCase();
			const settingItems = document.querySelectorAll('.setting-item');
			
			settingItems.forEach(item => {
				const label = item.querySelector('label');
				const settingName = label.textContent.toLowerCase();
				
				if (settingName.includes(searchTerm)) {
					item.style.display = 'flex';
				} else {
					item.style.display = 'none';
				}
			});
		});
		
		// Focus search input on load
		searchInput.focus();
	</script>
</body>
</html>`;
}
