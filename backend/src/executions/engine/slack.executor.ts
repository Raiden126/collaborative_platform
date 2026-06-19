import { Inject, Injectable } from '@nestjs/common';
import { WorkflowNode } from '@cwb/shared';
import { interpolateData } from './expression';
import { SLACK_TRANSPORT, SlackTransport } from './transports/slack.transport';
import { NodeExecutionError, NodeExecutor, NodeOutcome, RunContext } from './types';

@Injectable()
export class SlackExecutor implements NodeExecutor {
  readonly type = 'slack';

  constructor(@Inject(SLACK_TRANSPORT) private readonly transport: SlackTransport) {}

  async execute(node: WorkflowNode, ctx: RunContext): Promise<NodeOutcome> {
    const data = interpolateData(node.data ?? {}, ctx);
    const channel = String(data.channel ?? '').trim();
    const text = String(data.text ?? '').trim();

    if (!channel) throw new NodeExecutionError('Slack channel is required');
    if (!text) throw new NodeExecutionError('Slack message text is required');

    try {
      const result = await this.transport.send({
        channel,
        text,
        username: data.username as string | undefined,
        iconEmoji: data.iconEmoji as string | undefined,
      });
      return { output: result };
    } catch (err) {
      throw new NodeExecutionError((err as Error).message);
    }
  }
}