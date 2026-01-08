import path from 'path';
import { getConfigData, setConfigData } from './guoba/configHandler.js';
import guobaSchema from './guoba/configSchema.js';

export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'crystelf-plugin',
      title: '晶灵插件',
      description: '多功能娱乐插件，支持AI对话、图像生成、音乐点播、60s新闻、验证管理等功能',
      author: 'Jerry',
      authorLink: 'https://github.com/jerryplusy',
      link: 'https://github.com/jerryplusy/crystelf-plugin',
      isV3: true,
      isV2: false,
      showInMenu: 'auto',
      icon: 'mdi:crystal',
      iconColor: '#7c4dff',
      iconPath: path.join(process.cwd(), '/plugins/crystelf-plugin/resources/img/logo.png'),
    },
    configInfo: {
      schemas: guobaSchema,
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData,

      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData,
    },
  };
}
