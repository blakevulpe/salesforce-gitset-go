import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type CustomSettingsSelection = {
	CustomSettingsDataKeys: string[];
	/**
	 * Optional record-level selection.
	 * Keys are Custom Setting API names; values are stable record names.
	 *
	 * Currently we persist the record Name (preferred) and fall back to SetupOwnerId.
	 */
	CustomSettingsRecordNames?: Record<string, string[]>;
};

/**
 * Read custom settings selection from the YAML file.
 */
export function readCustomSettingsYaml(yamlFilePath: string): string[] {
	return readCustomSettingsSelection(yamlFilePath).CustomSettingsDataKeys;
}

export function readCustomSettingsSelection(yamlFilePath: string): CustomSettingsSelection {
	if (!fs.existsSync(yamlFilePath)) {
		return { CustomSettingsDataKeys: [] };
	}

	try {
		const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
		const yamlContent = (yaml.load(fileContent) as any) || {};

		const keys = Array.isArray(yamlContent.CustomSettingsDataKeys) ? yamlContent.CustomSettingsDataKeys : [];
		const recordNames =
			yamlContent.CustomSettingsRecordNames && typeof yamlContent.CustomSettingsRecordNames === 'object'
				? yamlContent.CustomSettingsRecordNames
				: undefined;

		return {
			CustomSettingsDataKeys: keys,
			CustomSettingsRecordNames: recordNames
		};
	} catch (error) {
		console.error('Error reading YAML file:', error);
		return { CustomSettingsDataKeys: [] };
	}
}

/**
 * Write custom settings selection to the YAML file.
 */
export function writeCustomSettingsYaml(yamlFilePath: string, settings: string[]): void {
	writeCustomSettingsSelection(yamlFilePath, { CustomSettingsDataKeys: settings });
}

export function writeCustomSettingsSelection(yamlFilePath: string, selection: CustomSettingsSelection): void {
	// Create the parent directory if it doesn't exist
	const yamlDir = path.dirname(yamlFilePath);
	if (!fs.existsSync(yamlDir)) {
		fs.mkdirSync(yamlDir, { recursive: true });
	}

	const normalized: CustomSettingsSelection = {
		CustomSettingsDataKeys: selection.CustomSettingsDataKeys || []
	};

	if (selection.CustomSettingsRecordNames && Object.keys(selection.CustomSettingsRecordNames).length > 0) {
		normalized.CustomSettingsRecordNames = selection.CustomSettingsRecordNames;
	}

	const updatedYaml = yaml.dump(normalized);
	fs.writeFileSync(yamlFilePath, updatedYaml, 'utf8');
}

/**
 * Add settings to the YAML file (without duplicates)
 */
export function addSettingsToYaml(yamlFilePath: string, newSettings: string[]): { added: string[], existing: string[] } {
	const existingSettings = readCustomSettingsYaml(yamlFilePath);
	const added: string[] = [];
	const existing: string[] = [];

	for (const setting of newSettings) {
		if (!existingSettings.includes(setting)) {
			existingSettings.push(setting);
			added.push(setting);
		} else {
			existing.push(setting);
		}
	}

	if (added.length > 0) {
		writeCustomSettingsYaml(yamlFilePath, existingSettings);
	}

	return { added, existing };
}

/**
 * Update the YAML file with a new list of settings (replaces existing).
 * If a setting type is removed, its record-level selection is also removed.
 */
export function updateSettingsInYaml(
	yamlFilePath: string,
	newSettings: string[]
): { added: string[]; removed: string[] } {
	const previous = readCustomSettingsSelection(yamlFilePath);

	const added = newSettings.filter(s => !previous.CustomSettingsDataKeys.includes(s));
	const removed = previous.CustomSettingsDataKeys.filter(s => !newSettings.includes(s));

	const recordNames = previous.CustomSettingsRecordNames ? { ...previous.CustomSettingsRecordNames } : undefined;
	if (recordNames) {
		for (const removedType of removed) {
			delete recordNames[removedType];
		}
	}

	writeCustomSettingsSelection(yamlFilePath, {
		CustomSettingsDataKeys: newSettings,
		CustomSettingsRecordNames: recordNames
	});

	return { added, removed };
}

/**
 * Ensure a directory exists for a custom setting
 */
export function ensureCustomSettingDirectory(workspaceRoot: string, settingName: string): string {
	const settingDir = path.join(workspaceRoot, 'force-app', 'main', 'default', 'custom-settings', settingName);
	
	if (!fs.existsSync(settingDir)) {
		fs.mkdirSync(settingDir, { recursive: true });
	}
	
	return settingDir;
}

/**
 * Get the path to the custom-settings.yaml file
 */
export function getYamlFilePath(workspaceRoot: string): string {
	return path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');
}
