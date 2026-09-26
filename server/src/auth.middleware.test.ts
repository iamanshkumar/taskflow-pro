import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { requireAuth, requireWorkspace } from "./middleware/auth.middleware";

function makeResponse() {
  const result: { statusCode?: number; body?: unknown } = {};
  const response = {
    status(statusCode: number) {
      result.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
  } as unknown as Response;
  return { response, result };
}

test("rejects requests without an authenticated session", () => {
  const request = { session: {} } as Request;
  const { response, result } = makeResponse();
  let nextCalled = false;

  requireAuth(request, response, () => {
    nextCalled = true;
  });

  assert.equal(result.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects authenticated sessions without an active workspace", async () => {
  const request = { session: { userId: "user-id" } } as Request;
  const { response, result } = makeResponse();
  let nextCalled = false;

  await requireWorkspace(request, response, () => {
    nextCalled = true;
  });

  assert.equal(result.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("allows requests with an authenticated session", () => {
  const request = { session: { userId: "user-id" } } as Request;
  const { response } = makeResponse();
  let nextCalled = false;

  requireAuth(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
