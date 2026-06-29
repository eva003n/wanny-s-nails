import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { Queue } from "bullmq";
import { _config } from "./config.js";
import { conversationQueue, notificationQueue, paymentQueue } from "./queues.js";

// Website: https://oneuptime.com/blog/post/2026-01-21-bullmq-bull-board/view#installing-bull-board

// create express adapter
export const serverAdapter = new ExpressAdapter();

type QueueGroup = {
  name: string;
  queues: Queue[];
};

const config = {
  APP_NAME: process.env.APP_NAME,
  API_DOC_URL: process.env.API_DOC_URL,
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
      serverAdapter: this.serverAdapter,
      options: {
        uiConfig: {
          boardTitle: _config.APP_NAME as string,
          boardLogo: {
            path: "/512.png",
            width: "32px",
            height: "32px",
          },
          favIcon: {
            default: "/512.png",
            alternative: "/192.png",
          },
          miscLinks: [
            {
              text: "Documentation",
              url: _config.API_DOC_URL as string,
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
    name: "Conversations",
    queues: [conversationQueue],
  },
];

export const groupedBoard = new GroupedBullBoard(groups);
