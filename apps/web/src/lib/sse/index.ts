import * as mock from "./mock";
import * as real from "./eventsource";

const useMock = import.meta.env.VITE_ENV === "testing";

export const subscribeSSE = useMock ? mock.subscribe : real.subscribe;

export const emitSSE = useMock ? mock.emit : () => {};

export const connectSSE = useMock ? () => {} : real.connect;

export const disconnectSSE = useMock ? () => {} : real.disconnect;