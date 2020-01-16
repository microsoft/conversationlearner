import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as TC from '../tipComponents'
import * as ToolTips from '../ToolTips/ToolTips'
import * as Util from '../../Utils/util'
import { FM } from '../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import CallbackResultModal from './CallbackResultViewerModal'
import './ActionCallbackResultDropdown.css'

type ReceivedProps = {
    action: CLM.ApiAction,
    callback: CLM.Callback | undefined,
    selectedCallbackResult?: CLM.CallbackResult,
    onChangeSelectedCallbackResult: (callbackResult: CLM.CallbackResult) => void,
}

type Props = ReceivedProps & InjectedIntlProps

const convertCallbackResultToDropdownOption = (callbackResult: CLM.CallbackResult): OF.IDropdownOption =>
    ({
        key: callbackResult.name,
        text: callbackResult.name,
        data: callbackResult,
    })

/**
 * Renders dropdown for mock result names of callback actions with preview modal.
 * This helps select which mock result should be used when the action is taken during training.
 */
const Component: React.FC<Props> = (props) => {
    const [isCallbackResultModalOpen, setIsCallbackResultModalOpen] = React.useState(false)
    const onClickViewCallbackResult = () => {
        setIsCallbackResultModalOpen(s => !s)
    }

    const onClickCancelStubViewer = () => {
        setIsCallbackResultModalOpen(false)
    }

    // Compute list of results from callbacks
    // If no results defined, show None and Disable preview.
    // If results defined list stub names and none selected.
    const noneOptionKey = 'none'
    const noneOption: OF.IDropdownOption = {
        key: noneOptionKey,
        text: 'None',
    }

    const callbackResultOptionsFromBot = (props.callback?.mockResults ?? []).map(convertCallbackResultToDropdownOption)
    const callbackResultOptionsFromModel = (props.action.clientData?.mockResults ?? []).map(convertCallbackResultToDropdownOption)

    const callbackResultOptions = [
        noneOption,
        ...callbackResultOptionsFromBot,
        ...callbackResultOptionsFromModel,
    ]

    const [selectedCallbackResultOptionKey, setSelectedCallbackResultOptionKey] = React.useState<string>(props.selectedCallbackResult?.name ?? noneOptionKey)
    const onChangeSelectedCallbackResult = (event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number | undefined) => {
        if (!option) {
            return
        }

        // TODO: Why need 'as' for types? Keys are all strings
        setSelectedCallbackResultOptionKey(option.key as string)
        props.onChangeSelectedCallbackResult(option.data)
    }

    const isCallbackResultViewDisabled = selectedCallbackResultOptionKey === noneOptionKey
    const selectedCallbackResult = props.callback?.mockResults.find(mockResult => mockResult.name === selectedCallbackResultOptionKey)

    return <>
        <div className="cl-callback-result-selector">
            <TC.Dropdown
                data-testid="action-callback-result-selector-dropdown"
                ariaLabel={Util.formatMessageId(props.intl, FM.CALLBACK_RESULT_DROPDOWN_LABEL)}
                label={Util.formatMessageId(props.intl, FM.CALLBACK_RESULT_DROPDOWN_LABEL)}
                options={callbackResultOptions}
                selectedKey={selectedCallbackResultOptionKey}
                onChange={onChangeSelectedCallbackResult}
                tipType={ToolTips.TipType.MOCK_RESULT}
            />

            <OF.IconButton
                data-testid="action-callback-result-selector-button"
                className="ms-Button--primary cl-callback-result-selector__preview-button"
                onClick={onClickViewCallbackResult}
                ariaDescription="View Result"
                iconProps={{ iconName: 'EntryView' }}
                disabled={isCallbackResultViewDisabled}
            />
        </div>

        <CallbackResultModal
            entities={[]}
            isOpen={isCallbackResultModalOpen}
            isEditing={false}
            onClickCancel={onClickCancelStubViewer}
            onClickSubmit={() => { }}
            callbackResult={selectedCallbackResult}
        />
    </>
}

export default injectIntl(Component)