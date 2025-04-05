declare global {
  interface Array<T> {
    distinct(): Array<T>;
    distinctBy<T>(selector: (x: T) => any): Array<T>;
    orderBy<T>(selector: (x: T) => any, asc?: boolean): Array<T>;
  }
}

Array.prototype.distinct = function () {
  return [...new Set(this)];
};

Array.prototype.distinctBy = function <T>(selector: (x: T) => any) {
  return this.filter((value, index, self) => self.findIndex((x) => selector(x) === selector(value)) === index);
};

Array.prototype.orderBy = function <T>(selector: (x: T) => any, asc: boolean = true) {
  return this.sort((a, b) => {
    const aValue = selector(a);
    const bValue = selector(b);
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return (asc ? 1 : -1) * aValue.localeCompare(bValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (asc ? 1 : -1) * (aValue - bValue);
    }
    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return (asc ? 1 : -1) * (aValue === bValue ? 0 : aValue ? -1 : 1);
    }
    if (aValue instanceof Date && bValue instanceof Date) {
      return (asc ? 1 : -1) * (aValue.getTime() - bValue.getTime());
    }
    // Unknown type, just compare as strings
    return (asc ? 1 : -1) * String(aValue).localeCompare(String(bValue));
  });
};

export {};
