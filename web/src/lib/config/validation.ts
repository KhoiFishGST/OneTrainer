import type { FieldError } from '../api/types';
import { getPath, setPath, cloneDocument } from './path';

export interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
  normalized: Record<string, any>;
}

export interface SchemaField {
  id: string;
  keys: string[];
  label?: string;
  tooltip?: string;
  control?: string;
  required?: boolean;
  nullable?: boolean;
  visible?: boolean;
  path_mode?: string;
  options?: Array<{ value: any; label: string } | string>;
  min?: number;
  max?: number;
}

export interface SchemaGroup {
  id: string;
  label?: string;
  title?: string;
  fields?: SchemaField[];
}

export interface SchemaTab {
  id: string;
  label?: string;
  groups?: SchemaGroup[];
}

export interface ConfigSchema {
  tabs?: SchemaTab[];
  groups?: SchemaGroup[];
  fields?: SchemaField[];
  [key: string]: any;
}

function extractFields(schema: ConfigSchema): SchemaField[] {
  const fields: SchemaField[] = [];

  if (schema.fields && Array.isArray(schema.fields)) {
    fields.push(...schema.fields);
  }

  const groups = schema.groups || [];
  for (const group of groups) {
    if (group.fields && Array.isArray(group.fields)) {
      fields.push(...group.fields);
    }
  }

  const tabs = schema.tabs || [];
  for (const tab of tabs) {
    if (tab.groups && Array.isArray(tab.groups)) {
      for (const group of tab.groups) {
        if (group.fields && Array.isArray(group.fields)) {
          fields.push(...group.fields);
        }
      }
    }
  }

  return fields;
}

export function validateConfig(draft: Record<string, any>, schema: ConfigSchema): ValidationResult {
  const errors: FieldError[] = [];
  let normalized = cloneDocument(draft || {});
  const fields = extractFields(schema);

  for (const field of fields) {
    if (!field.keys || !Array.isArray(field.keys)) continue;

    for (const key of field.keys) {
      const val = getPath(draft, key);

      // Check null value
      if (val === null) {
        if (field.nullable === false && field.required) {
          errors.push({ path: key, message: 'Value cannot be null' });
        } else {
          normalized = setPath(normalized, key, null);
        }
        continue;
      }

      // Check undefined for required
      if (val === undefined) {
        if (field.required) {
          errors.push({ path: key, message: 'Field is required' });
        }
        continue;
      }

      // Check empty string
      if (val === '') {
        if (field.required) {
          errors.push({ path: key, message: 'Field is required' });
          continue;
        }
        if (field.nullable) {
          normalized = setPath(normalized, key, null);
          continue;
        }
      }

      const control = (field.control || '').toLowerCase();

      // Integer validation
      if (control === 'integer' || control === 'int') {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          const num = Number(trimmed);
          if (trimmed === '' || isNaN(num) || !Number.isFinite(num) || !Number.isInteger(num)) {
            errors.push({ path: key, message: 'Expected integer' });
          } else {
            normalized = setPath(normalized, key, num);
          }
        } else if (typeof val === 'number') {
          if (!Number.isFinite(val) || !Number.isInteger(val)) {
            errors.push({ path: key, message: 'Expected integer' });
          } else {
            normalized = setPath(normalized, key, val);
          }
        } else {
          errors.push({ path: key, message: 'Expected integer' });
        }
      }
      // General Number / Float validation
      else if (control === 'number' || control === 'float' || control === 'double') {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          const num = Number(trimmed);
          if (trimmed === '' || isNaN(num) || !Number.isFinite(num)) {
            errors.push({ path: key, message: 'Expected number' });
          } else {
            normalized = setPath(normalized, key, num);
          }
        } else if (typeof val === 'number') {
          if (!Number.isFinite(val)) {
            errors.push({ path: key, message: 'Expected number' });
          } else {
            normalized = setPath(normalized, key, val);
          }
        } else {
          errors.push({ path: key, message: 'Expected number' });
        }
      }
      // Enum / Select validation
      else if ((control === 'select' || control === 'dropdown' || control === 'enum') && field.options) {
        const allowed = field.options.map((opt) => (typeof opt === 'object' && opt !== null ? opt.value : opt));
        if (!allowed.includes(val)) {
          errors.push({ path: key, message: 'Invalid option' });
        } else {
          normalized = setPath(normalized, key, val);
        }
      }
      else {
        // Generic path or string or boolean
        normalized = setPath(normalized, key, val);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalized,
  };
}
