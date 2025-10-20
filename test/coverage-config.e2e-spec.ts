import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const { loadNycConfig } = createRequire(__filename)('@istanbuljs/load-nyc-config') as {
  loadNycConfig: (options: { cwd: string; nycrcPath: string }) => Promise<Record<string, unknown>>;
};

describe('coverage YAML dependency compatibility', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zm-server-nyc-'));
  });

  afterEach(() => {
    if (!resolve(directory).startsWith(join(resolve(tmpdir()), 'zm-server-nyc-'))) {
      throw new Error('拒绝清理测试临时目录之外的路径');
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads real NYC YAML configuration and inherited options with the resolved parser', async () => {
    writeFileSync(join(directory, 'base.yaml'), 'include:\n  - "src/**/*.ts"\ncheck-coverage: true\n', 'utf8');
    writeFileSync(join(directory, '.nycrc.yaml'), 'extends: ./base.yaml\nreporter:\n  - text-summary\n', 'utf8');
    await expect(loadNycConfig({ cwd: directory, nycrcPath: '.nycrc.yaml' })).resolves.toMatchObject({
      include: ['src/**/*.ts'],
      checkCoverage: true,
      reporter: ['text-summary'],
    });
  });

  it('rejects executable JavaScript tags in YAML configuration', async () => {
    writeFileSync(join(directory, '.nycrc.yaml'), 'value: !!js/function "function () { return true; }"\n', 'utf8');
    await expect(loadNycConfig({ cwd: directory, nycrcPath: '.nycrc.yaml' })).rejects.toThrow(/unknown tag/);
  });
});
