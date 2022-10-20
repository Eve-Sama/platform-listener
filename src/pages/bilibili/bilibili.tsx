import { useEffect, useRef, useState } from 'react';
import { getAccount, getMessage, getStat, getUnread } from '../../request';
import { Spin, message } from 'antd';
import styles from './style.module.scss';
import { CountdownDisplayRef, CountdownDisplay } from '../common/countdown-display/countdown-display';
import { DataCard } from '../common/data-card/data-card';
import { Group } from '../setting/common/group-setting/group.interface';
import { BilibiliCardGroupList, BilibiliConfig } from '../setting/setting-bilibili/setting-bilibili.interface';
import { combileArrayBy } from '../../common/utils-function';

const key = 'bilibili';
const broadcastChannel = new BroadcastChannel(key);

export function Bilibili() {
  const [statData, setStatData] = useState<any>({});
  const [unreadData, setUnreadData] = useState<any>({});
  const [messageData, setMessageData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [retryTimes, setRetryTimes] = useState(0);
  const countdownRef = useRef<CountdownDisplayRef>(null);

  let storageData: BilibiliConfig;
  let dataCardList: BilibiliConfig['dataCardList'];
  let groupList: BilibiliConfig['config']['groupList'];
  let config: BilibiliConfig['config'];
  const bilibiliCardList = combileArrayBy(BilibiliCardGroupList, 'children');
  const maxRequestTimes = 3;

  const updateStorageData = () => {
    storageData = window.electron.store.get(`${key}-data`) as BilibiliConfig;
    dataCardList = storageData.dataCardList;
    groupList = storageData.config.groupList;
    config = storageData.config;
  };
  updateStorageData();

  useEffect(function listenBrodcast() {
    setLoading(true);
    broadcastChannel.onmessage = v => {
      if (v.data === `${key}-init`) {
        updateStorageData();
        loadData();
      }
    };
    loadData();
  }, []);

  useEffect(
    function notify() {
      if (beingInit()) {
        return;
      }
      const typeList: string[] = [];
      const tempDataCardList: BilibiliConfig['dataCardList'] = [];
      groupList.forEach(group =>
        group.cardList.forEach(card => {
          if (card.notify) {
            typeList.push(card.type);
            const data = getDataCardInfo(card.type);
            tempDataCardList.push({
              type: data.type,
              value: data.totalValue,
            });
          }
        }),
      );
      window.electron.store.set(`${key}-data`, { ...storageData, dataCardList: tempDataCardList });
      tempDataCardList.forEach(tempDataCard => {
        const dataCard = dataCardList.find(v => v.type === tempDataCard.type);
        /**
         * 需要判断 dataCard 是否存在. 因为存在一种场景, 当打开了B站面板与设置面板时, 设置面板的 dataCardList 始终是不会变化的, 而B站面板会在每次请求结束后重新设置 dataCardList
         * 这就导致, B站面板的 dataCardList 会变而设置面板的 dataCardList 不会变. 那就有可能导致保存配置而触发的重渲染时, tempDataCardList 与 dataCardList 长度可能不一样
         */
        if (dataCard) {
          if (tempDataCard.value > dataCard.value) {
            const title = bilibiliCardList.find(v => v.value === tempDataCard.type).label;
            window.electron.ipcRenderer.send('notify', { title: `哔哩哔哩 - ${title}`, url: 'https://message.bilibili.com/#/reply' });
          }
        }
      });
    },
    [messageData],
  );

  useEffect(
    function retryRequest() {
      switch (retryTimes) {
        /** @todo: 这个0是初始化导致的执行, 后面可以看看有没有办法避开 */
        case 0:
          break;
        case 1:
        case 2:
          message.error(`鉴权失败, 3秒后将重试(${retryTimes}/3).`);
          if (retryTimes < maxRequestTimes) {
            setTimeout(loadData, 3 * 1000);
          }
          break;
        case 3:
          message.error('鉴权失败, 请打开『偏好设置』设置cookie!');
          break;
        default:
          message.error('鉴权失败, 请打开『偏好设置』设置cookie!');
          break;
      }
    },
    [retryTimes],
  );

  const beingInit = () => Object.keys(messageData).length === 0;

  const setDefaultTitle = () => window.electron.ipcRenderer.send(`${key}-set-title`, '哔哩哔哩');

  const loadData = () => {
    setLoading(true);
    Promise.all([getStat(), getAccount(), getUnread(), getMessage()])
      .then(v => {
        let showError = false;
        // 处理统计数据
        const [tempStatData, tempAccountData, tempUnreadData, tempMessageData] = v;
        const responseTempStatData = tempStatData.data;
        if (responseTempStatData.code === 0) {
          setStatData(responseTempStatData.data);
        } else {
          setStatData({});
          showError = true;
        }
        // 处理账户信息
        const responseTempAccountData = tempAccountData.data;
        if (responseTempAccountData.code === 0) {
          window.electron.ipcRenderer.send(`${key}-set-title`, `哔哩哔哩 - ${responseTempAccountData.data.uname}`);
        } else {
          setDefaultTitle();
          showError = true;
        }
        // 获取回复条数
        const responseTempUnreadData = tempUnreadData.data;
        if (responseTempUnreadData.code === 0) {
          setUnreadData(responseTempUnreadData.data);
        } else {
          setUnreadData({});
          showError = true;
        }
        // 获取私信条数
        const responseTempMessageData = tempMessageData.data;
        if (responseTempMessageData.code === 0) {
          setMessageData(responseTempMessageData.data);
        } else {
          setMessageData({});
          showError = true;
        }
        // 统一报错
        if (showError) {
          handleRequestError();
          countdownRef.current?.setMode('error');
          countdownRef.current?.startCountdown('0:0:0');
        } else {
          setRetryTimes(0);
          countdownRef.current?.setMode('normal');
          countdownRef.current?.startCountdown(config.refreshTime);
        }
      })
      .catch(() => {
        handleRequestError();
        countdownRef.current?.setMode('error');
        countdownRef.current?.startCountdown('0:0:0');
      })
      .finally(() => setLoading(false));
  };

  const handleRequestError: () => void = () => {
    setRetryTimes(retryTimes + 1);
    setDefaultTitle();
  };

  const initGroupComponents = () => {
    const res: JSX.Element[] = [];
    groupList.forEach((group, index) => {
      const cardComponents = getDataCardComponents(group.cardList);
      res.push(
        <div key={index}>
          <span className={styles['group-label']}>{group.label}</span>
          <div className={styles['group-card-list']} style={{ gridTemplateColumns: `repeat(${group.columnNum}, 1fr)` }}>
            {cardComponents}
          </div>
        </div>,
      );
    });
    return res;
  };

  const getDataCardInfo = (type: string) => {
    const target = bilibiliCardList.find(v => v.value === type);
    let dataSource: object;
    if (['fan', 'click', 'totalReply', 'dm', 'totalLike', 'share', 'favorite', 'coin'].includes(type)) {
      dataSource = statData;
    } else if (['reply', 'at', 'like', 'systemMessage'].includes(type)) {
      dataSource = unreadData;
    } else if (['message'].includes(type)) {
      dataSource = messageData;
    }
    const changeValue = target.changeValue.reduce((pre, cur) => pre + dataSource[cur], 0);
    const totalValue = target.totalValue.reduce((pre, cur) => pre + dataSource[cur], 0);
    return {
      type,
      title: target.label,
      changeValue: changeValue,
      // totalValue 在 'message' 类型下, 可能为 NaN
      totalValue: totalValue || 0,
    };
  };

  const getDataCardComponents = (cardList: Group['cardList']) => {
    const res: JSX.Element[] = [];
    if (beingInit()) {
      return res;
    }
    cardList.forEach(card => {
      const data = getDataCardInfo(card.type);
      res.push(<DataCard key={data.type} title={data.title} changeValue={data.changeValue} totalValue={data.totalValue}></DataCard>);
    });
    return res;
  };

  return (
    <div className={styles['bilibili-container']}>
      <div style={{ display: config.showCountdown ? 'flex' : 'none' }}>
        <CountdownDisplay loadData={loadData} ref={countdownRef} />
      </div>
      <Spin tip="Loading..." spinning={loading}>
        <div className={styles['group-container']}>{initGroupComponents()}</div>
      </Spin>
    </div>
  );
}
