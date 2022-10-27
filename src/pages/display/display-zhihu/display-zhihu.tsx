import { useEffect } from 'react';

import { BasicInfo, Message } from '../../../request/request-zhihu/request-zhihu.interface';
import { getBaiscInfo, getMessage } from '../../../request/request-zhihu/request-zhihu.request';
import { DataCardGroup } from '../../common/group-setting/group.interface';
import { useTemplate } from '../../common/template/display-template/display-template';
import { ZhihuDefaultConfig, ZhihuOptionalCardGroupList } from '../../setting/setting-zhihu/setting-zhihu.interface';

export function Zhihu() {
  const key = 'zhihu';

  let basicInfo: BasicInfo;
  let message: Message;

  const { getRenderDOM, analyzeRequest, analyzeDataCard, forceUpdate } = useTemplate({ key, cardGroupList: ZhihuOptionalCardGroupList, defaultConfig: ZhihuDefaultConfig, title: '知乎' });

  useEffect(() => {
    analyzeRequest([getBaiscInfo, getMessage], data => {
      let showError = false;
      // 处理基础信息
      const [tempBasicInfo, tempMessage] = data;
      const responseCountData = tempBasicInfo.data;
      if (responseCountData.pv) {
        basicInfo = tempBasicInfo.data;
      } else {
        basicInfo = null;
        showError = true;
      }
      // 处理账户信息
      const responseUserData = tempMessage.data;
      if (responseUserData.name) {
        window.electron.ipcRenderer.send('set-title', { key, title: `知乎 - ${responseUserData.name}` });
        message = responseUserData;
      } else {
        showError = true;
      }
      forceUpdate();
      return showError;
    });
  }, []);

  useEffect(() => {
    analyzeDataCard((type: string, cardList: DataCardGroup['children']) => {
      const target = cardList.find(v => v.value === type);
      let dataSource: object;
      if (['play', 'collect', 'comment', 'like', 'like_and_reaction', 'pv', 'share', 'upvote'].includes(type)) {
        dataSource = basicInfo;
      } else if (['messages_count'].includes(type)) {
        dataSource = message;
      } else {
        throw new Error(`Can not find type of card: ${type}`);
      }
      return { target, dataSource };
    });
  }, []);

  return getRenderDOM();
}
