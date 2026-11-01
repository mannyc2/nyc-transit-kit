#!/usr/bin/env bun
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as Stdio from "effect/Stdio"
import * as Cli from "./Cli"

Stdio.Stdio.pipe(
  Effect.flatMap((stdio) => stdio.args),
  Effect.flatMap(Cli.run),
  Effect.provide(Layer.mergeAll(BunServices.layer, FetchHttpClient.layer)),
  BunRuntime.runMain
)
