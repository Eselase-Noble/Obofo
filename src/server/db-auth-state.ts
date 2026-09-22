import {
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { prisma } from '../lib/db';

/**
 * A Baileys auth store backed by the WaSession row for one user — the multi-tenant
 * equivalent of `useMultiFileAuthState`. Credentials live in `creds`, and the signal
 * key store is flattened into a single `keys` JSON object keyed by "<type>-<id>".
 *
 * Buffers are (de)serialized with Baileys' BufferJSON so they survive the JSON column.
 */
export async function useDbAuthState(userId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  // The WaSession row must already exist (created when the user starts linking).
  const record = await prisma.waSession.findUnique({ where: { userId } });

  const creds: AuthenticationCreds = record?.creds
    ? JSON.parse(JSON.stringify(record.creds), BufferJSON.reviver)
    : initAuthCreds();

  const keys: Record<string, unknown> = record?.keys
    ? JSON.parse(JSON.stringify(record.keys), BufferJSON.reviver)
    : {};

  async function persist(): Promise<void> {
    await prisma.waSession.update({
      where: { userId },
      data: {
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      },
    });
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const out: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const id of ids) {
          let value = keys[`${type}-${id}`];
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value as object);
          }
          if (value !== undefined) out[id] = value as SignalDataTypeMap[typeof type];
        }
        return out;
      },
      set: async (data) => {
        for (const type in data) {
          const typed = data[type as keyof SignalDataTypeMap]!;
          for (const id in typed) {
            const value = typed[id];
            const key = `${type}-${id}`;
            if (value) keys[key] = value;
            else delete keys[key];
          }
        }
        await persist();
      },
    },
  };

  return { state, saveCreds: persist };
}
