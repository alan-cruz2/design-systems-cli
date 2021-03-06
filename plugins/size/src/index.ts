import {
  createLogger
} from '@design-systems/cli-utils';
import { Plugin } from '@design-systems/plugin';
import fs from 'fs-extra';
import {
  SizeArgs,
  SizeResult} from "./interfaces"
import { formatLine, formatExports } from "./utils/formatUtils";
import { calcSizeForAllPackages, reportResults, table, diffSizeForPackage } from "./utils/CalcSizeUtils";
import { startAnalyze } from "./utils/WebpackUtils";
import { createDiff } from "./utils/DiffUtils";

const logger = createLogger({ scope: 'size' });
const FAILURE_THRESHOLD = 5;

const cssHeader = [
  'master: js',
  'pr: js',
  '+/-',
  '%',
  'master: css',
  'pr: css',
  '+/-',
  '%'
];

const defaultHeader = ['master', 'pr', '+/-', '%'];

/** A plugin to determine the size changes of packages. */
export default class SizePlugin implements Plugin<SizeArgs> {
  async run(args: SizeArgs) {
    if (args.ci) {
      logger.disable();
    }

    if (fs.existsSync('lerna.json')) {
      calcSizeForAllPackages(args);
      return;
    }

    const name = process.env.npm_package_name;

    if (!name) {
      throw new Error('Could not find "process.env.npm_package_name"');
    }

    if (args.analyze) {
      await startAnalyze(name, args.registry);
      return;
    }

    if (args.diff) {
      logger.warn(
        'Bundle sizes will be larger during `--diff` because we do not minify for readability'
      );
    }

    const size: SizeResult = await diffSizeForPackage({
      name,
      main: process.cwd(),
      persist: args.persist || args.diff,
      chunkByExport: args.detailed,
      diff: args.diff,
      registry: args.registry
    });
    const header = args.css ? cssHeader : defaultHeader;

    await reportResults(
      name,
      size.percent <= FAILURE_THRESHOLD || size.percent === Infinity,
      Boolean(args.comment),
      table(
        args.detailed
          ? [['name', ...header], ...formatExports(size, args.css)]
          : [header, formatLine(size, args.css)],
        args.ci
      )
    );

    if (args.persist) {
      logger.success('Generated `bundle-master` and `bundle-pr`!');
    }

    if (args.diff) {
      createDiff();
    }

    if (size && size.percent > FAILURE_THRESHOLD && size.percent !== Infinity) {
      process.exit(1);
    }
  }
}
