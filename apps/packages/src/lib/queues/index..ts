import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "../config.js";
import type { Queue } from "bullmq";
import { bookingQueue, notificationQueue, reminderQueue, paymentQueue } from "./queues.js";

// Website: https://oneuptime.com/blog/post/2026-01-21-bullmq-bull-board/view#installing-bull-board

// create express adapter
export const serverAdapter = new ExpressAdapter();
// serverAdapter.setBasePath("/queues");

// import created queues

//  create dashboard
/* createBullBoard({

  serverAdapter,
  options: {
    uiConfig: {
        boardTitle: APP_NAME,
        miscLinks: [
            {
                text: "Documentation",
                url: API_DOC_URI as string
            }
        ]
    }
  }
}); */

type QueueGroup = {
  name: string;
  queues: Queue[];
};

// grouped bullboard
class GroupedBullBoard {
  private serverAdapter: ExpressAdapter;

  constructor(groups: QueueGroup[]) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath("/api/v1/admin/queues");

    // flattenand prefiz queue names for grouping
    const adapters = groups.flatMap((group) =>
      group.queues.map((queue) => {
        //prefix to identify group
        const adapter = new BullMQAdapter(queue, {
          description: `Group:${group.name}`,
        });

        return adapter;
      }),
    );

    createBullBoard({
      queues: adapters,
      serverAdapter: this.serverAdapter ,
      options: {
        uiConfig: {
          boardTitle: config.APP_NAME as string,
          miscLinks: [
            {
              text: "Documentation",
              url: config.API_DOC_URL as string,
            },
          ],
        },
      },
    });
  }

  getRouter() {
    return this.serverAdapter.getRouter();
  }
}

const groups: QueueGroup[] = [
  {
    name: "Payments",
    queues: [paymentQueue],
  },
  {
    name: "Notifications",
    queues: [notificationQueue],
  },
  {
    name: "Remainders",
    queues: [reminderQueue],
  },
  {
    name: "Bookings",
    queues: [bookingQueue],
  },
];

export const groupedBoard = new GroupedBullBoard(groups);
export * from "./queues.js"