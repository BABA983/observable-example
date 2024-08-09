import { suite, test } from "vitest";
import { ObservableValue } from "../base";
import assert from "assert";

suite("observable", () => {
  suite("tutorial", () => {
    test("get + set", () => {
      const observable = new ObservableValue(0);
      assert.deepStrictEqual(observable.get(), 0);
      observable.set(1);
      assert.deepStrictEqual(observable.get(), 1);
    });
  });
});
