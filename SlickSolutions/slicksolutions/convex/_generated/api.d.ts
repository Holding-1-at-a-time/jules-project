/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai_businessOptimizer from "../ai/businessOptimizer.js";
import type * as ai_customerConcierge from "../ai/customerConcierge.js";
import type * as assessments from "../assessments.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as chat from "../chat.js";
import type * as clerk from "../clerk.js";
import type * as clients from "../clients.js";
import type * as cron_businessOptimizer from "../cron/businessOptimizer.js";
import type * as hello from "../hello.js";
import type * as http from "../http.js";
import type * as payments from "../payments.js";
import type * as recommendations from "../recommendations.js";
import type * as reports from "../reports.js";
import type * as services from "../services.js";
import type * as stripe from "../stripe.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tenants from "../tenants.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "ai/businessOptimizer": typeof ai_businessOptimizer;
  "ai/customerConcierge": typeof ai_customerConcierge;
  assessments: typeof assessments;
  auth: typeof auth;
  bookings: typeof bookings;
  chat: typeof chat;
  clerk: typeof clerk;
  clients: typeof clients;
  "cron/businessOptimizer": typeof cron_businessOptimizer;
  hello: typeof hello;
  http: typeof http;
  payments: typeof payments;
  recommendations: typeof recommendations;
  reports: typeof reports;
  services: typeof services;
  stripe: typeof stripe;
  subscriptions: typeof subscriptions;
  tenants: typeof tenants;
  users: typeof users;
  utils: typeof utils;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
