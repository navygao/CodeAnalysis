/**
 * 添加/编辑过滤路径模态框
 */

import React, { useEffect } from 'react';
import cn from 'classnames';

import { Input, Radio, Form, Modal, Tooltip } from 'coding-oa-uikit';

import QuestionCircle from 'coding-oa-uikit/lib/icon/QuestionCircle';


import style from './style.scss';
import formStyle from '../style.scss';
import { useForm } from 'coding-oa-uikit/lib/form/util';

interface IProps {
  visible: boolean; // 模态框是否显示
  data?: object; // 模态框数据
  isEditModal: boolean;
  onUpdateScanDir: (data: any) => void;
  onHide: (e: any) => void;
}

const UpdateModal = (props: IProps) => {
  const { visible, isEditModal, data, onHide, onUpdateScanDir } = props;
  const [form] = useForm();

  useEffect(() => {
    visible && form.resetFields();
  }, [visible]);

  const onFinish = (formData: any) => {
    onUpdateScanDir(formData);
  };

  return (
    <Modal
      title={`${isEditModal ? '编辑' : '添加'}路径过滤`}
      visible={visible}
      onCancel={onHide}
      width={520}
      className={style.addPathModal}
      okText={isEditModal ? '确定' : '添加'}
      onOk={() => form.validateFields().then(onFinish)}
    >
      <Form
        layout='vertical'
        className={cn(style.form, formStyle.schemeFormVertical)}
        form={form}
        onFinish={onFinish}
        initialValues={
          data || {
            path_type: 2,
            scan_type: 2,
          }}
      >
        <Form.Item
          label='路径类型'
          name='path_type'
          rules={[
            { required: true, message: '请选择路径类型' },
          ]}
        >
          <Radio.Group>
            <Radio value={2}>
              正则表达式
                            <Tooltip
                overlayClassName={style.descTooltip}
                // @ts-ignore
                getPopupContainer={() => document.getElementById('container')}
                title={
                  <ul>
                    <li>请填写相对路径(基于代码库根目录)，要求匹配到文件</li>
                    <li>
                      使用Unix通配符格式，示例如下：
                                            <ul className={style.example}>
                        <li>代码根目录</li>
                        <li>|-src</li>
                        <li style={{ paddingLeft: 20 }}>|- test</li>
                        <li style={{ paddingLeft: 40 }}>|- main_test.py</li>
                        <li style={{ paddingLeft: 40 }}>|- input_test.py</li>
                        <li style={{ paddingLeft: 20 }}>|- main.py</li>
                        <li>|-test</li>
                        <li style={{ paddingLeft: 20 }}>|- param_test.py</li>
                        <li>匹配src/test目录：src/test/.*</li>
                        <li>匹配根目录下的test目录：test/.*</li>
                        <li>匹配所有_test.py后缀的文件：*_test\.py</li>
                      </ul>
                    </li>
                    <li>修改后，下次分析生效，需要启动一次全量分析处理历史存量问题</li>
                  </ul>
                }
              >
                <QuestionCircle className={formStyle.questionIcon} />
              </Tooltip>
            </Radio>
            <Radio value={1}>
              通配符
                            <Tooltip
                overlayClassName={style.descTooltip}
                // @ts-ignore
                getPopupContainer={() => document.getElementById('container')}
                title={
                  <ul className={style.descContent}>
                    <li>请填写相对路径(基于代码库根目录)，要求匹配到文件</li>
                    <li>
                      使用Unix通配符格式，示例如下：
                                            <ul className={style.example}>
                        <li>代码根目录</li>
                        <li>|-src</li>
                        <li style={{ paddingLeft: 20 }}>|- test</li>
                        <li style={{ paddingLeft: 40 }}>|- main_test.py</li>
                        <li style={{ paddingLeft: 40 }}>|- input_test.py</li>
                        <li style={{ paddingLeft: 20 }}>|- main.py</li>
                        <li>|-test</li>
                        <li style={{ paddingLeft: 20 }}>|- param_test.py</li>
                        <li>匹配src/test目录：src/test/*</li>
                        <li>匹配根目录下的test目录：test/*</li>
                        <li>匹配所有_test.py后缀的文件：*_test.py</li>
                      </ul>
                    </li>
                    <li>修改后，下次分析生效，需要启动一次全量分析处理历史存量问题</li>
                  </ul>
                }
              >
                <QuestionCircle className={formStyle.questionIcon} />
              </Tooltip>
            </Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label='目录/文件路径'
          name='dir_path'
          rules={[
            { required: true, message: '请输入目录/文件路径' },
          ]}
        >
          <Input autoFocus placeholder='请输入路径' />
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, curValues) => prevValues.path_type !== curValues.path_type}
        >
          {
            ({ getFieldValue }) => (
              <Form.Item
                label='过滤类型'
                name='scan_type'
                rules={[
                  { required: true, message: '请选择过滤类型' },
                ]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group>
                  <Radio value={1}>
                    include（包含）
                                            <Tooltip
                      overlayClassName={style.descTooltip}
                      // @ts-ignore
                      getPopupContainer={() => document.getElementById('container')}
                      title={`表示只分析，如只分析 src/ 目录：src/${getFieldValue('path_type') === 1 ? '' : '.'}*`}
                    >
                      <QuestionCircle className={formStyle.questionIcon} />
                    </Tooltip>
                  </Radio>
                  <Radio value={2}>
                    exclude（过滤）
                                            <Tooltip
                      overlayClassName={style.descTooltip}
                      // @ts-ignore
                      getPopupContainer={() => document.getElementById('container')}
                      title={`表示只屏蔽，如要屏蔽 src/lib/ 目录：src/lib/${getFieldValue('path_type') === 1 ? '' : '.'}*`}
                    >
                      <QuestionCircle className={formStyle.questionIcon} />
                    </Tooltip>
                  </Radio>

                </Radio.Group>
              </Form.Item>
            )
          }
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UpdateModal;
