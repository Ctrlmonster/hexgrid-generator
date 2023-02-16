// TODO: all internal methods that use forEach should use for-of instead
export default class TypedSet<V> extends Set<V> {

  constructor(values?: readonly V[] | null | Set<V>) {
    super(values)
  }

  get isEmptySet() {
    return this.size === 0;
  }

  toArr() {
    return Array.from(this.values());
  }

  override forEach(forEachFn: (value: V, valAgain: V, set: Set<V>, i: number) => void): this {
    let i = 0;
    super.forEach((val, valAgain, set) => {
      forEachFn(val, valAgain, set, i);
      i++;
    });
    return this;
  }

  getNthValue(n: number): V | undefined {
    let i = 0;
    let nthValue = undefined;
    for (const value of this.values()) {
      if (i === n) {
        nthValue = value;
        break;
      }
      i++;
    }
    return nthValue;
  }

  getRandomValue() {
    const idx = Math.trunc(Math.random() * this.size);
    return this.getNthValue(idx);
  }

  addMany(...values: V[]): this {
    for (const value of values) this.add(value);
    return this;
  }

  deleteMany(...values: V[]): this {
    for (const value of values) this.delete(value);
    return this;
  }

  // Set Operations ====================================================================================================


  uniteWith(otherSetOrArray: (Set<V> | Array<V>)): this { // can also be called with arrays
    for (const value of otherSetOrArray) this.add(value);
    return this;
  }

  intersectWith(otherSetOrArray: Set<V> | Array<V>):this {
    let magnitude, contains;
    // get the appropriate character, depending on if a set or array was passed
    if (Array.isArray(otherSetOrArray)) {
      magnitude = "length";
      contains = "includes";
    } else {
      magnitude = "size";
      contains = "has";
    }
    // @ts-ignore: check if the otherSetOrArray is empty
    if (otherSetOrArray[magnitude] === 0) {
      this.clear();
      return this;
    }
    for (const value of this) {
      // @ts-ignore: otherwise remove every value from set, that the otherSetOrArray does not have
      if (!otherSetOrArray[contains](value)) {
        this.delete(value);
      }
    }
    return this;
  }

  without(otherSetOrArray: (Set<V> | Array<V>)): this {
    // check which set is the bigger one
    const mySize = this.size;
    let othersSize, contains;
    // get the appropriate character, depending on if a set or array was passed
    if (Array.isArray(otherSetOrArray)) {
      contains = "includes";
      othersSize = otherSetOrArray.length;
    } else {
      contains = "has";
      othersSize = otherSetOrArray.size;
    }

    // if either are empty, just return the set
    if (mySize === 0 || othersSize === 0)
      return this;

    // optimization to loop over the smaller set
    let setToBeLoopedOver, setToBeCheckedAgainst;
    if (mySize < othersSize) {
      setToBeLoopedOver = this;
      setToBeCheckedAgainst = otherSetOrArray;
    } else {
      setToBeLoopedOver = otherSetOrArray;
      setToBeCheckedAgainst = this;
    }
    // if the other setOrArray contains the value, remove it from this set
    for (const value of setToBeLoopedOver) {
      // @ts-ignore
      if (setToBeCheckedAgainst[contains](value)) {
        this.delete(value);
      }
    }
    return this;
  }


  // static versions of all set operations

  static union(a: TypedSet<any>, b: Set<any> | Array<any>): TypedSet<any> {
    return a.clone().uniteWith(b);
  }

  static intersection(a: TypedSet<any>, b: Set<any> | Array<any>): TypedSet<any> {
    return a.clone().intersectWith(b);
  }

  static complement(a: TypedSet<any>, b: Set<any> | Array<any>): TypedSet<any> {
    return a.clone().without(b);
  }


  // ===================================================================================================================


  // only clones the set, no values
  clone(): TypedSet<V> {
    const s1 = new TypedSet<V>();
    this.forEach((val: any) => {
      s1.add(val);
    });
    return s1;
  }


  sort(sortFn: (a: V, b: V) => number): this {
    const arr = this.toArr();
    const size = this.size;
    arr.sort((a, b) => sortFn(a, b))
    this.clear();
    for (let i = 0; i < size; i++) {
      const val = arr[i];
      this.add(val);
    }
    return this;
  }

  mapValues<T>(mapFn: (value: V, valAgain: V, set: Set<V>, i: number) => T): TypedSet<T> {
    const s1 = new TypedSet<T>();
    this.forEach((val: V, valAgain: V, set: Set<V>, i: number) => {
      const res = mapFn(val, valAgain, set, i);
      s1.add(res);
    });
    return s1;
  }

  filter(testFn: (value: V, valAgain: V, set: Set<V>, i: number) => any): TypedSet<V> {
    const s1 = new TypedSet<V>();
    this.forEach((val: any, valAgain: any, set: Set<any>, i: number,) => {
      if (testFn(val, valAgain, set, i))
        s1.add(val);
    });
    return s1;
  }

  find(testFn: (value: V, valAgain: V, set: Set<V>, i: number) => any): V | undefined {
    let foundData = undefined;
    this.forEach((val: any, valAgain: any, set: Set<any>, i: number) => {
      if (testFn(val, valAgain, set, i)) {
        foundData = val;
      }
    });
    return foundData;
  }


  some(testFn: (value: V, valAgain: V, set: Set<V>, i: number) => any): boolean {
    let found = false;
    // using for of loop, because forEach does not support breaking
    for (const value of this) {
      if (testFn(value, value, this, 0)) {
        found = true;
        break;
      }
    }
    return found;
  }

  every(testFn: (value: V, valAgain: V, set: Set<V>, i: number) => any): boolean {
    let found = true;
    // using for of loop, because forEach does not support breaking
    for (const value of this) {
      if (!testFn(value, value, this, 0)) {
        found = false;
        break;
      }
    }
    return found;
  }

  // will always return TypedSet<unknown>
  // cast to a specific type on creation. e.g:
  // TypedSet.fromFn(10, i => i) as TypedSet<number>
  static fromFn(size: number, creationFn: (i: number) => any): TypedSet<any> {
    const s1 = new TypedSet();
    for (let i = 0; i < size; i++) {
      s1.add(creationFn(i));
    }
    return s1;
  }

  // will always return TypedSet<unknown>
  // cast to generic type of other set, if that sets type is known
  static copy(otherSet: Set<unknown>): TypedSet<unknown> {
    const s1 = new TypedSet();
    otherSet.forEach((val) => {
      s1.add(val);
    });
    return s1;
  }
}

