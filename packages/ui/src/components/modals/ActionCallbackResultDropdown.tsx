import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as TC from '../tipComponents'
import * as ToolTips from '../ToolTips/ToolTips'
import * as Util from '../../Utils/util'
import { FM } from '../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import CallbackResultViewerModal from './CallbackResultViewerModal'
import './ActionCallbackResultDropdown.css'

type ReceivedProps = {
    action: CLM.ApiAction,
    callback: CLM.Callback | undefined,
    selectedCallbackResult?: CLM.CallbackResult,
    onChangeSelectedCallbackResult: (callbackResult: CLM.CallbackResult) => void,
}

type Props = ReceivedProps & InjectedIntlProps

const Component: React.FC<Props> = (props) => {
    const [isCallbackResultViewerOpen, setIsCallbackResultViewerOpen] = React.useState(false)
    const onClickViewCallbackResult = () => {
        setIsCallbackResultViewerOpen(s => !s)
    }

    const onClickCancelStubViewer = () => {
        setIsCallbackResultViewerOpen(false)
    }

    // Compute list of results from callbacks
    // If no results defined, show None and Disable preview.
    // If results defined list stub names and none selected.
    const noneOptionKey = 'none'
    const callbackResultOptions: OF.IDropdownOption[] = [
        {
            key: noneOptionKey,
            text: 'None',
        },
    ]

    // TODO: Add options from stubs defined on model
    const callback = props.callback
    if (callback?.results) {
        const callbackResultOptionsFromBot = callback.results.map<OF.IDropdownOption>(callbackResult => ({
            key: callbackResult.name,
            text: callbackResult.name,
            data: callbackResult,
        }))

        callbackResultOptions.push(...callbackResultOptionsFromBot)
    }

    const [selectedCallbackResultOptionKey, setSelectedCallbackResultOptionKey] = React.useState(props.selectedCallbackResult?.name ?? noneOptionKey)
    // React.useEffect(() => {
    //     const name = props.selectedCallbackResult?.name
    //     if (name) {
    //         setSelectedCallbackResultOptionKey(name)
    //     }
    // }, [props.selectedCallbackResult?.name])
    const onChangeSelectedCallbackResult = (event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number | undefined) => {
        if (!option) {
            return
        }

        // TODO: Why need 'as' for types? Keys are all strings
        setSelectedCallbackResultOptionKey(option.key as string)
        props.onChangeSelectedCallbackResult(option.data)
    }



    const isCallbackResultViewDisabled = selectedCallbackResultOptionKey === noneOptionKey
    const selectedCallbackResult = callback?.results.find(callbackResult => callbackResult.name === selectedCallbackResultOptionKey)

    return <>
        <div className="cl-callback-result-selector">
            <TC.Dropdown
                ariaLabel={Util.formatMessageId(props.intl, FM.CALLBACK_RESULT_DROPDOWN_LABEL)}
                label={Util.formatMessageId(props.intl, FM.CALLBACK_RESULT_DROPDOWN_LABEL)}
                options={callbackResultOptions}
                selectedKey={selectedCallbackResultOptionKey}
                onChange={onChangeSelectedCallbackResult}
                tipType={ToolTips.TipType.CALLBACK_RESULT}
            />

            <OF.IconButton
                className="ms-Button--primary cl-callback-result-selector__preview-button"
                onClick={onClickViewCallbackResult}
                ariaDescription="View Result"
                iconProps={{ iconName: 'EntryView' }}
                disabled={isCallbackResultViewDisabled}
            />
        </div>

        {selectedCallbackResult
            && <CallbackResultViewerModal
                isOpen={isCallbackResultViewerOpen}
                onClickCancel={onClickCancelStubViewer}
                onClickSubmit={() => { }}
                callbackResult={selectedCallbackResult}
            />}
    </>
}

export default injectIntl(Component)