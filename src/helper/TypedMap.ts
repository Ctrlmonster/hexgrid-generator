import TypedSet from "./TypedSet";

// TODO: all internal methods that use forEach should use for-of instead
export default class TypedMap<K, V> extends Map<K, V> {
  constructor(entries?: readonly [K, V][] | null | Map<K, V>) {
    super(entries);
  }

  get isEmpty() {
    return this.size === 0;
  }

  setMany(...entries: [K, V][]): this {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
    return this;
  }

  deleteMany(...keys: K[]): this {
    for (const key of keys) {
      this.delete(key);
    }
    return this;
  }

  hasValue(value: V): boolean {
    return this.toValueArr().includes(value);
  }

  toArr(): [K, V][] {
    return [...this];
  }

  toValueArr(): V[] {
    return [...this.values()];
  }

  toKeyArr(): K[] {
    return [...this.keys()];
  }

  toValueSet(): TypedSet<V> {
    return new TypedSet(this.toValueArr());
  }

  toKeySet(): TypedSet<K> {
    return new TypedSet(this.toKeyArr());
  }

  override forEach(forEachFn: (val: V, key: K, map: Map<K, V>, i: number) => void): this {
    let i = 0;
    super.forEach((val, key, map) => {
      forEachFn(val, key, map, i);
      i++;
    });
    return this;
  }


  getNthEntry(n: number): [K, V] | undefined {
    let nthEntry = undefined;
    this.forEach((val, key, map, i) => {
      if (i === n) {
        nthEntry = [key, val];
      }
    });
    return nthEntry;
  }

  getNthValue(n: number): V | undefined {
    let nthValue = undefined;
    this.forEach((val, key, map, i) => {
      if (i === n) {
        nthValue = val;
      }
    });
    return nthValue;
  }

  getNthKey(n: number): K | undefined {
    let nthKey = undefined;
    this.forEach((val, key, map, i) => {
      if (i === n) {
        nthKey = key;
      }
    });
    return nthKey;
  }


  // returns undefined if the set is empty
  getRandomEntry(): [K, V] | undefined {
    if (this.size === 0) return undefined;
    const idx = Math.trunc(Math.random() * this.size);
    return this.getNthEntry(idx);
  }

  getRandomValue(): V | undefined {
    if (this.size === 0) return undefined;
    const idx = Math.trunc(Math.random() * this.size);
    return this.getNthValue(idx);
  }

  getRandomKey(): K | undefined {
    if (this.size === 0) return undefined;
    const idx = Math.trunc(Math.random() * this.size);
    return this.getNthKey(idx);
  }

  // creationFn needs to return a key, value pair.
  // Generic types will always be unknown.
  // Cast generic types on creation
  static fromFn(size: number, creationFn: (i: number) => [any, any]): TypedMap<unknown, unknown> {
    const m1 = new TypedMap();
    for (let i = 0; i < size; i++) {
      const [val, key] = creationFn(i);
      m1.set(val, key);
    }
    return m1;
  }

  // value type can't be known, cast value type on creation
  static fromIdxArr(arr: Array<any>): TypedMap<number, unknown> {
    const m1 = new TypedMap<number, any>();
    for (let i = 0; i < arr.length; i++) {
      const value = arr[i];
      m1.set(i, value);
    }
    return m1;
  }

  // value type can't be known, cast value type on creation.
  // if keys do not include symbol, key type can be cast to string as well.
  static fromObj(obj: object): TypedMap<string | symbol, unknown> {
    const m1 = new TypedMap<string | symbol, any>();
    for (const [key, value] of Object.entries(obj)) {
      m1.set(key, value);
    }
    return m1;
  }

  static copy(otherMap: Map<any, any>): TypedMap<unknown, unknown> {
    const m1 = new TypedMap();
    otherMap.forEach((val, key) => {
      m1.set(key, val);
    });
    return m1;
  }

  copyValues(otherMap: Map<any, any>): this {
    otherMap.forEach((val, key) => {
      this.set(key, val);
    });
    return this;
  }


  // only clones the map, not keys or values
  clone(): TypedMap<K, V> {
    const m1 = new TypedMap<K, V>();
    this.forEach((val: any, key: any) => {
      m1.set(key, val);
    });
    return m1;
  }

  // sorts the map by values and returns it
  sortByVal(sortFn: (a: V, b: V) => number): this {
    const size = this.size;
    const arr = this.toArr();
    arr.sort((a, b) => sortFn(a[1], b[1]))
    this.clear();

    for (let i = 0; i < size; i++) {
      const [key, value] = arr[i];
      this.set(key, value);
    }
    return this;
  }

  // sorts the map by keys and returns it
  sortByKey(sortFn: (a: K, b: K) => number): this {
    const size = this.size;
    const arr = this.toArr();
    arr.sort((a, b) => sortFn(a[0], b[0]))
    this.clear();

    for (let i = 0; i < size; i++) {
      const [key, value] = arr[i];
      this.set(key, value);
    }
    return this;
  }

  // returns a new TypedMap with same generic types and mapped values
  mapValues<T>(mapFn: (val: V, key: K, map: Map<K, V>, i: number) => T): TypedMap<K, T> {
    const m1 = new TypedMap<K, T>();
    this.forEach((val, key, map, i) => {
      const res = mapFn(val, key, map, i);
      m1.set(key, res); // keep the same key as in the original map
    });
    return m1;
  }

  // returns a new TypedMap with same generic types, mapped keys and values
  mapEntries<N, T>(mapFn: (val: V, key: K, map: Map<K, V>, i: number) => [N, T]): TypedMap<N, T> {
    const m1 = new TypedMap<N, T>();
    this.forEach((val, key, map, i) => {
      const res = mapFn(val, key, map, i);
      const [newKey, newVal] = res;
      m1.set(newKey, newVal);
    });
    return m1;
  }

  // returns a new TypedMap with a filter function applied
  filter(testFn: (val: V, key: K, map: Map<K, V>, i: number) => boolean): TypedMap<K, V> {
    const m1 = new TypedMap<K, V>();
    this.forEach((val, key, map, i) => {
      if (testFn(val, key, map, i))
        m1.set(key, val);
    });
    return m1;
  }

  find(testFn: (val: V, key: K, map: Map<K, V>, i: number) => boolean): undefined | V {
    let i = 0;
    let foundData = undefined;
    for (const [key, value] of this.entries()) {
      if (testFn(value, key, this, i)) {
        foundData = value;
        break;
      }
      i++;
    }
    return foundData;
  }

  findIndex(testFn: (val: V, key: K, map: Map<K, V>, i: number) => boolean): number {
    let i = 0;
    let foundIndex = -1;
    for (const [key, value] of this.entries()) {
      if (testFn(value, key, this, i)) {
        foundIndex = i;
        break;
      }
      i++;
    }
    return foundIndex;
  }
}