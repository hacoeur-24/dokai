import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toString as mdastToString } from 'mdast-util-to-string';
import type { Heading, Root } from 'mdast';
import { frontmatterSchema, type Frontmatter } from './schemas/frontmatter.js';
import { createSlugger } from './slug.js';
import type { DocHeading } from './types.js';

export interface ParsedDoc {
  frontmatter: Frontmatter;
  /** Body markdown (frontmatter stripped). */
  bodyMarkdown: string;
  /** Plain-text body for indexing. */
  bodyText: string;
  /** Headings in document order with deterministic slugs. */
  headings: DocHeading[];
  /** Validation errors that did not block parsing — used for dev toasts. */
  validationErrors: string[];
}

const processor = unified().use(remarkParse).use(remarkGfm);

export async function parseDocFile(absolutePath: string): Promise<ParsedDoc> {
  const raw = await readFile(absolutePath, 'utf8');
  return parseDocSource(raw);
}

export function parseDocSource(source: string): ParsedDoc {
  const { data, content } = matter(source);

  const validationErrors: string[] = [];
  const fmResult = frontmatterSchema.safeParse(data);
  const frontmatter = fmResult.success
    ? fmResult.data
    : (() => {
        for (const issue of fmResult.error.issues) {
          validationErrors.push(`${issue.path.join('.') || '<root>'}: ${issue.message}`);
        }
        return frontmatterSchema.parse({
          title: typeof data['title'] === 'string' && data['title'] ? data['title'] : 'Untitled',
          description:
            typeof data['description'] === 'string' && data['description']
              ? data['description']
              : ' ',
        });
      })();

  const tree = processor.parse(content) as Root;
  const slugger = createSlugger();
  const headings: DocHeading[] = [];
  for (const node of tree.children) {
    if (node.type === 'heading') {
      const heading = node as Heading;
      const text = mdastToString(heading);
      headings.push({ depth: heading.depth, text, slug: slugger.next(text) });
    }
  }

  return {
    frontmatter,
    bodyMarkdown: content,
    bodyText: mdastToString(tree),
    headings,
    validationErrors,
  };
}
