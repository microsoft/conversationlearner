import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as TC from '../tipComponents'
import * as ToolTips from '../ToolTips/ToolTips'
import * as Util from '../../Utils/util'
import { FM } from '../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import StubViewerModal from './StubViewerModal'
import './ActionStubDropdown.css'

type ReceivedProps = {
    action: CLM.ApiAction,
    callback: CLM.Callback | undefined,
    selectedStub?: CLM.StubInfo,
}

type Props = ReceivedProps & InjectedIntlProps

const Component: React.FC<Props> = (props) => {
    const [isStubViewerOpen, setIsStubViewerOpen] = React.useState(false)
    const onClickViewStub = () => {
        setIsStubViewerOpen(s => !s)
    }

    const onClickCancelStubViewer = () => {
        setIsStubViewerOpen(false)
    }

    // Compute list of stubs from callbacks
    // If no stubs defined, show None and Disable preview.
    // If stubs defined list stub names and none selected.
    const noneOptionKey = 'none'
    const stubOptions: OF.IDropdownOption[] = [
        {
            key: noneOptionKey,
            text: 'None',
        },
    ]

    const [selectedStubOptionKey, setSelectedStubOptionKey] = React.useState(noneOptionKey)
    const onChangeStubSelected = (event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number | undefined) => {
        if (!option) {
            return
        }

        // TODO: Why need as for types? Keys are all strings
        setSelectedStubOptionKey(option.key as string)
    }

    const callback = props.callback
    if (callback?.stubs) {
        const definedStubOptions = callback.stubs.map<OF.IDropdownOption>(stubInfo => ({
            key: stubInfo.name,
            text: stubInfo.name,
            data: stubInfo,
        }))

        stubOptions.push(...definedStubOptions)
    }

    const isStubViewDisabled = selectedStubOptionKey === noneOptionKey
    const selectedStubInfo = callback?.stubs.find(si => si.name === selectedStubOptionKey)

    return <>
        <div className="cl-stub-selector">
            <TC.Dropdown
                ariaLabel={Util.formatMessageId(props.intl, FM.STUB_DROPDOWN_LABEL)}
                label={Util.formatMessageId(props.intl, FM.STUB_DROPDOWN_LABEL)}
                options={stubOptions}
                selectedKey={selectedStubOptionKey}
                onChange={onChangeStubSelected}
                tipType={ToolTips.TipType.STUB_MODAL_ENTITY_VALUES}
            />

            <OF.IconButton
                className="ms-Button--primary cl-stub-selector__preview-button"
                onClick={onClickViewStub}
                ariaDescription="View Stub"
                iconProps={{ iconName: 'EntryView' }}
                disabled={isStubViewDisabled}
            />
        </div>

        {selectedStubInfo
            && <StubViewerModal
                isOpen={isStubViewerOpen}
                onClickCancel={onClickCancelStubViewer}
                onClickSubmit={() => { }}
                stubInfo={selectedStubInfo}
            />}
    </>
}

export default injectIntl(Component)