import { expectType } from "./utilities";

expectType(Bun.redis.publish("hello", "world")).is<Promise<number>>();

const copy = await Bun.redis.duplicate();
expectType(copy.connected).is<boolean>();
expectType(copy).is<Bun.RedisClient>();

const listener: Bun.RedisClient.StringPubSubListener = (message, channel) => {
  expectType(message).is<string>();
  expectType(channel).is<string>();
};
Bun.redis.subscribe("hello", listener);

// Buffer subscriptions are not yet implemented
// const bufferListener: Bun.RedisClient.BufferPubSubListener = (message, channel) => {
//   expectType(message).is<Uint8Array<ArrayBuffer>>();
//   expectType(channel).is<string>();
// };
// Bun.redis.subscribe("hello", bufferListener);

expectType(
  copy.subscribe("hello", message => {
    expectType(message).is<string>();
  }),
).is<Promise<number>>();

await copy.unsubscribe();
await copy.unsubscribe("hello");

expectType(copy.unsubscribe("hello", () => {})).is<Promise<void>>();

expectType(Bun.redis.bitcount("key")).is<Promise<number>>();
expectType(Bun.redis.bitcount("key", 0, -1)).is<Promise<number>>();
expectType(Bun.redis.bitcount("key", 5, 30, "BIT")).is<Promise<number>>();
expectType(Bun.redis.bitcount("key", 1, 1, "BYTE")).is<Promise<number>>();
// @ts-expect-error BITCOUNT takes start and end together
Bun.redis.bitcount("key", 0);
// @ts-expect-error the unit is BYTE or BIT
Bun.redis.bitcount("key", 0, -1, "NIBBLE");
