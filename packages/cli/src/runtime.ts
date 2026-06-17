import type { CliRuntime } from "./commands/types"
import { mtaCliLayer, mtaRealtimeCliLayer, soda3CliLayer } from "./config"

export const makeCliRuntime = (env: Readonly<Record<string, string | undefined>>): CliRuntime => {
  const soda3Layer = soda3CliLayer({
    appToken: env.SOCRATA_APP_TOKEN
  })

  return {
    soda3Layer,
    mtaLayer: mtaCliLayer,
    mtaRealtimeLayer: mtaRealtimeCliLayer
  }
}
