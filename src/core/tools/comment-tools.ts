import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { CommentsInput, PostCommentInput, DeleteCommentInput } from "../types/tools.js";
import type { FigmaComment } from "../types/figma-api.js";

function commentsToMarkdown(comments: FigmaComment[]): string {
  if (comments.length === 0) return "No comments found.";

  // Group by thread (parent_id)
  const threads = new Map<string, FigmaComment[]>();
  const topLevel: FigmaComment[] = [];

  for (const c of comments) {
    if (c.parent_id) {
      const thread = threads.get(c.parent_id) ?? [];
      thread.push(c);
      threads.set(c.parent_id, thread);
    } else {
      topLevel.push(c);
    }
  }

  const lines: string[] = [`# Comments (${comments.length} total)\n`];

  for (const c of topLevel) {
    const resolved = c.resolved_at ? " [RESOLVED]" : "";
    const location = c.client_meta?.node_id ? ` (node: ${c.client_meta.node_id})` : "";
    lines.push(`## ${c.user.handle}${resolved}${location}`);
    lines.push(`*${c.created_at}* | ID: \`${c.id}\`\n`);
    lines.push(c.message);
    lines.push("");

    const replies = threads.get(c.id);
    if (replies) {
      for (const r of replies) {
        lines.push(`> **${r.user.handle}** — *${r.created_at}*`);
        lines.push(`> ${r.message}`);
        lines.push("");
      }
    }
    lines.push("---\n");
  }

  return lines.join("\n");
}

export function registerCommentTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  // ---- figma_get_comments ----
  server.tool(
    "figma_get_comments",
    "Get all comments from a Figma file. Supports markdown output with threaded replies.",
    CommentsInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        logger.info({ fileKey }, "Fetching comments");
        const { comments } = await apiClient.getComments(fileKey);

        if (args.as_md) {
          return { content: [{ type: "text", text: commentsToMarkdown(comments) }] };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  comments: comments.map((c) => ({
                    id: c.id,
                    user: c.user.handle,
                    message: c.message,
                    createdAt: c.created_at,
                    resolvedAt: c.resolved_at,
                    parentId: c.parent_id,
                    nodeId: c.client_meta?.node_id,
                  })),
                  total: comments.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_post_comment ----
  server.tool(
    "figma_post_comment",
    "Post a comment on a Figma file. Can be attached to a node, pinned to coordinates, or a reply to another comment.",
    PostCommentInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        logger.info({ fileKey, nodeId: args.node_id }, "Posting comment");
        const result = await apiClient.postComment(fileKey, args.message, {
          nodeId: args.node_id,
          x: args.x,
          y: args.y,
          parentId: args.parent_id,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, comment: result }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_delete_comment ----
  server.tool(
    "figma_delete_comment",
    "Delete a comment from a Figma file by comment ID.",
    DeleteCommentInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        logger.info({ fileKey, commentId: args.comment_id }, "Deleting comment");
        await apiClient.deleteComment(fileKey, args.comment_id);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, deleted: args.comment_id }) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
