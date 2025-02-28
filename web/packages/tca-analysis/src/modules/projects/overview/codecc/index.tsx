/**
 * 分支概览圈复杂度详情
 */
import React, { useState } from 'react';
import { Radio, Row, Col } from 'coding-oa-uikit';
import classnames from 'classnames';
import { get } from 'lodash';

// 项目内
import NoData from '../no-data';
import Line from '@src/components/charts/line';
import DataPie from '@src/components/charts/data-pie';
import s from '../style.scss';
import { t } from '@src/i18n/i18next';
import { STANDARD_TYPE, STANDARD_OPTIONS } from '@src/modules/projects/constants';
import { getCyCLineChartData, getCycPieChartData } from '../utils';

export const CYC_TYPE = {
  TOTAL: 'total',
  OVER: 'over',
  EXCESS: 'excess',
};

export const CYC_TYPE_TXT = {
  TOTAL: t('总数'),
  OVER: t('超标数'),
  EXCESS: t('未超标数'),
};

const CYC_TYPE_OPTIONS = [
  {
    label: CYC_TYPE_TXT.TOTAL,
    value: CYC_TYPE.TOTAL,
  },
  {
    label: CYC_TYPE_TXT.OVER,
    value: CYC_TYPE.OVER,
  },
];

interface IProps {
  cycScans: Array<any>;
}

const CodeCC = ({ cycScans }: IProps) => {
  const [typeValue, setTypeValue] = useState(CYC_TYPE.TOTAL);
  const [standardValue, setStandardValue] = useState(STANDARD_TYPE.DEFAULT);
  const cycLineDatas = getCyCLineChartData(cycScans, standardValue);
  const cycLineData = get(cycLineDatas, typeValue, []);
  const cycPieData = getCycPieChartData(cycScans, standardValue);
  // 校验是否展示标准切换radio，如果最新的数据，不存在custom_summary，则不显示 radio
  const isShowStandardRadio = () => {
    let show = false;
    cycScans.forEach((item) => {
      if (!show && item.default_summary && item.custom_summary) {
        show = true;
      }
    });
    return show;
  };
  return (
        <div className={s.item}>
            <div className={classnames(s.header, 'overflow-hidden')}>
                <span className={s.tit}>{t('圈复杂度详情')}</span>
                {isShowStandardRadio() && (
                    <Radio.Group
                        className="float-right"
                        value={standardValue}
                        size="small"
                        onChange={e => setStandardValue(e.target.value)}
                    >
                        {STANDARD_OPTIONS.map(item => (
                            <Radio.Button key={item.value} value={item.value}>
                                {item.label}
                            </Radio.Button>
                        ))}
                    </Radio.Group>
                )}
            </div>
            <div className={s.content}>
                <Row gutter={[40, 14]}>
                    <Col span={12}>{t('方法圈复杂度分布')}</Col>
                    <Col span={12}>{t('历史趋势')}</Col>
                    <Col span={12} style={{ height: '222px' }}>
                        {cycPieData.length > 0 ? (
                            <DataPie data={cycPieData} />
                        ) : (
                            <NoData style={{ marginTop: '76px' }} />
                        )}
                    </Col>
                    <Col span={12} className={s.borderLeft} style={{ height: '222px' }}>
                        <Radio.Group
                            value={typeValue}
                            size="small"
                            onChange={e => setTypeValue(e.target.value)}
                        >
                            {CYC_TYPE_OPTIONS.map(item => (
                                <Radio.Button key={item.value} value={item.value}>
                                    {item.label}
                                </Radio.Button>
                            ))}
                        </Radio.Group>
                        {cycLineData.length > 0 ? (
                            <Line
                                data={cycLineData}
                                xAxisKey="date"
                                yAxisKey="num"
                                cols={{
                                  date: {
                                    range: [0, 1],
                                    tickCount: 5,
                                  },
                                }}
                                padding={[10, 'auto', 100, 'auto']}
                            />
                        ) : (
                            <NoData style={{ marginTop: '52px' }} />
                        )}
                    </Col>
                </Row>
                {/* <div className={`${s.panelContent}`} style={{ marginTop: '14px' }}>
                    <div className={s.chartBox}>
                        <p>{t('超标圈复杂度总数趋势')}</p>
                        <div className={s.chartCell}></div>
                    </div>
                    <div className={s.chartBox}>
                        <p>{t('千行代码平均圈复杂度')}</p>
                        <div className={`${s.chartCell} ${s.borderLeft}`}></div>
                    </div>
                </div> */}
            </div>
        </div>
  );
};

export default CodeCC;
