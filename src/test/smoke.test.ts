import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

describe("Testing framework smoke test", () => {
  it("vitest runs correctly", () => {
    expect(1 + 1).toBe(2)
  })

  it("jest-dom matchers are available", () => {
    const el = document.createElement("div")
    el.textContent = "hello"
    document.body.appendChild(el)
    expect(el).toBeInTheDocument()
    document.body.removeChild(el)
  })

  it("fast-check property testing works", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        // addition is commutative
        return a + b === b + a
      })
    )
  })
})
