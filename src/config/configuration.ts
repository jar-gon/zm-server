import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { join } from 'path';
import { _merge } from 'src/utils/lodash';

const CONFIG_PATH = join(__dirname, '../../config/config.yaml');
const ENV_CONFIG_PATH = join(__dirname, `../../config/config.${process.env.NODE_ENV || 'development'}.yaml`);

const COMMON_CONFIG = (yaml.load(readFileSync(CONFIG_PATH, 'utf8')) ?? {}) as Record<string, unknown>;
const ENV_CONFIG = (existsSync(ENV_CONFIG_PATH) ? yaml.load(readFileSync(ENV_CONFIG_PATH, 'utf8')) : {}) as Record<
  string,
  unknown
>;

export default () => {
  const config: Record<string, unknown> = _merge(COMMON_CONFIG, ENV_CONFIG);

  // 校验或者转换
  // if (config.cookie && config.cookie.maxAge && config.cookie.maxAge.indexOf('*') > -1) {
  //   config.cookie.maxAge = eval(config.cookie.maxAge);
  // }

  // if (config.http.port < 1024 || config.http.port > 49151) {
  //   throw new Error('HTTP port must be between 1024 and 49151');
  // }

  return config;
};
