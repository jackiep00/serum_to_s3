// save working file name to disk

import { MarketMeta } from './types';
import 

// for a given market and filename:

export async function pullAndSaveSerumEventsToCSV(
  market: MarketMeta,
  fileName: string,
): Promise<void> {
  // check the file for the last seqNum
  import {} from 
  // pull the events since the last seqNum
  // write the new seqNum
  // write events to a target CSV
}
