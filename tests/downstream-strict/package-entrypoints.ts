import * as cli from "@nyc-transit-kit/cli"
import * as compat from "@nyc-transit-kit/compat"
import * as compatErrors from "@nyc-transit-kit/compat/errors"
import * as compatMta from "@nyc-transit-kit/compat/mta"
import * as compatNycDot from "@nyc-transit-kit/compat/nyc-dot"
import * as compatNycOpenData from "@nyc-transit-kit/compat/nyc-open-data"
import * as compatSoda3 from "@nyc-transit-kit/compat/soda3"
import * as contracts from "@nyc-transit-kit/contracts"
import * as contractsCli from "@nyc-transit-kit/contracts/cli"
import * as contractsDescriptorRegistry from "@nyc-transit-kit/contracts/descriptor-registry"
import * as contractsIds from "@nyc-transit-kit/contracts/ids"
import * as contractsMetadata from "@nyc-transit-kit/contracts/metadata"
import * as contractsMta from "@nyc-transit-kit/contracts/mta"
import * as contractsNycDot from "@nyc-transit-kit/contracts/nyc-dot"
import * as contractsNycOpenData from "@nyc-transit-kit/contracts/nyc-open-data"
import * as contractsRelease from "@nyc-transit-kit/contracts/release"
import * as contractsSoda3 from "@nyc-transit-kit/contracts/soda3"
import * as fixtures from "@nyc-transit-kit/fixtures"
import * as mta from "@nyc-transit-kit/mta"
import * as mtaClient from "@nyc-transit-kit/mta/client"
import * as mtaDatasets from "@nyc-transit-kit/mta/datasets"
import * as mtaElevatorEscalator from "@nyc-transit-kit/mta/elevator-escalator"
import * as mtaErrors from "@nyc-transit-kit/mta/errors"
import * as mtaFeeds from "@nyc-transit-kit/mta/feeds"
import * as mtaGtfsRealtime from "@nyc-transit-kit/mta/gtfs-realtime"
import * as mtaGtfsStatic from "@nyc-transit-kit/mta/gtfs-static"
import * as mtaJsonDirect from "@nyc-transit-kit/mta/json-direct"
import * as mtaOpenData from "@nyc-transit-kit/mta/open-data"
import * as mtaOpenDataCatalog from "@nyc-transit-kit/mta/open-data-catalog"
import * as nycDot from "@nyc-transit-kit/nyc-dot"
import * as nycDotBusLanes from "@nyc-transit-kit/nyc-dot/bus-lanes"
import * as nycDotClient from "@nyc-transit-kit/nyc-dot/client"
import * as nycDotDatasets from "@nyc-transit-kit/nyc-dot/datasets"
import * as nycDotErrors from "@nyc-transit-kit/nyc-dot/errors"
import * as nycDotTrafficSpeeds from "@nyc-transit-kit/nyc-dot/traffic-speeds"
import * as nycDotTrafficVolume from "@nyc-transit-kit/nyc-dot/traffic-volume"
import * as nycOpenData from "@nyc-transit-kit/nyc-open-data"
import * as nycOpenDataCatalog from "@nyc-transit-kit/nyc-open-data/catalog"
import * as nycOpenDataClient from "@nyc-transit-kit/nyc-open-data/client"
import * as nycOpenDataDatasets from "@nyc-transit-kit/nyc-open-data/datasets"
import * as nycOpenDataDescriptors from "@nyc-transit-kit/nyc-open-data/descriptors"
import * as nycOpenDataQuery from "@nyc-transit-kit/nyc-open-data/query"
import * as soda3 from "@nyc-transit-kit/soda3"
import * as soda3Catalog from "@nyc-transit-kit/soda3/catalog"
import * as soda3Client from "@nyc-transit-kit/soda3/client"
import * as soda3Endpoints from "@nyc-transit-kit/soda3/endpoints"
import * as soda3Errors from "@nyc-transit-kit/soda3/errors"
import * as soda3Export from "@nyc-transit-kit/soda3/export"
import * as soda3Metadata from "@nyc-transit-kit/soda3/metadata"
import * as soda3Query from "@nyc-transit-kit/soda3/query"
import * as soda3Soql from "@nyc-transit-kit/soda3/soql"

export const publishedPackageEntrypoints = [
  cli,
  compat,
  compatErrors,
  compatMta,
  compatNycDot,
  compatNycOpenData,
  compatSoda3,
  contracts,
  contractsCli,
  contractsDescriptorRegistry,
  contractsIds,
  contractsMetadata,
  contractsMta,
  contractsNycDot,
  contractsNycOpenData,
  contractsRelease,
  contractsSoda3,
  fixtures,
  mta,
  mtaClient,
  mtaDatasets,
  mtaElevatorEscalator,
  mtaErrors,
  mtaFeeds,
  mtaGtfsRealtime,
  mtaGtfsStatic,
  mtaJsonDirect,
  mtaOpenData,
  mtaOpenDataCatalog,
  nycDot,
  nycDotBusLanes,
  nycDotClient,
  nycDotDatasets,
  nycDotErrors,
  nycDotTrafficSpeeds,
  nycDotTrafficVolume,
  nycOpenData,
  nycOpenDataCatalog,
  nycOpenDataClient,
  nycOpenDataDatasets,
  nycOpenDataDescriptors,
  nycOpenDataQuery,
  soda3,
  soda3Catalog,
  soda3Client,
  soda3Endpoints,
  soda3Errors,
  soda3Export,
  soda3Metadata,
  soda3Query,
  soda3Soql
] as const
