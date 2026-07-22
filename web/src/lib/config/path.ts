export function getPath(obj: Record<string, any>, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!path) return obj;
  if (Object.prototype.hasOwnProperty.call(obj, path)) {
    return obj[path];
  }

  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

export function setPath<T extends Record<string, any>>(obj: T, path: string, value: any): T {
  const root = obj && typeof obj === 'object' ? obj : ({} as T);

  if (!path.includes('.')) {
    return {
      ...root,
      [path]: value,
    };
  }

  const parts = path.split('.');

  function updateNested(current: any, index: number): any {
    const key = parts[index];
    const currentObj = current && typeof current === 'object' ? current : {};

    if (index === parts.length - 1) {
      return {
        ...currentObj,
        [key]: value,
      };
    }

    return {
      ...currentObj,
      [key]: updateNested(currentObj[key], index + 1),
    };
  }

  return updateNested(root, 0) as T;
}

export function cloneDocument<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // Fallback if structuredClone fails
    }
  }
  return JSON.parse(JSON.stringify(obj));
}
