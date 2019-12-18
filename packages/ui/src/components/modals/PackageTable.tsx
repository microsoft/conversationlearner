/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import * as OF from 'office-ui-fabric-react'
import { AppBase, PackageReference } from '@conversationlearner/models'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import * as util from '../../Utils/util'

interface IRenderableColumn extends OF.IColumn {
    render: (packageReference: PackageReference, component: PackageTable) => React.ReactNode
}

const columns: IRenderableColumn[] = [
    {
        key: 'tag',
        name: 'Tag',
        fieldName: 'Tag',
        minWidth: 100,
        maxWidth: 200,
        isResizable: true,
        render: (packageReference, component) => {
            return <span className={`${OF.FontClassNames.mediumPlus}`}>{packageReference.packageVersion}</span>
        }
    },
    {
        key: 'isEditing',
        name: 'Editing',
        fieldName: 'isEditing',
        minWidth: 100,
        maxWidth: 100,
        isResizable: true,
        render: (packageReference, component) => <OF.Icon iconName={packageReference.packageId === component.props.editingPackageId ? 'CheckMark' : 'Remove'} className="cl-icon" />,
    },
    {
        key: 'isLive',
        name: 'Live',
        fieldName: 'isLive',
        minWidth: 100,
        maxWidth: 100,
        isResizable: true,
        render: (packageReference, component) => <OF.Icon iconName={packageReference.packageId === component.props.app.livePackageId ? 'CheckMark' : 'Remove'} className="cl-icon" />,
    }
]

interface ComponentState {
    columns: IRenderableColumn[]
}

class PackageTable extends React.Component<Props, ComponentState> {
    constructor(p: any) {
        super(p)
        this.state = {
            columns: columns,
        }
    }

    renderItemColumn(packageReference: PackageReference, index: number, column: IRenderableColumn) {
        return column.render(packageReference, this)
    }

    render() {
        const packageReferences = util.packageReferences(this.props.app)
        return (
            <OF.DetailsList
                className={OF.FontClassNames.mediumPlus}
                items={packageReferences}
                columns={this.state.columns}
                onRenderItemColumn={(packageReference, i, column: IRenderableColumn) => column.render(packageReference, this)}
                checkboxVisibility={OF.CheckboxVisibility.hidden}
                constrainMode={OF.ConstrainMode.horizontalConstrained}
            />
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
    }, dispatch)
}
const mapStateToProps = (state: State, ownProps: any) => {
    return {
    }
}

export interface ReceivedProps {
    app: AppBase,
    editingPackageId: string
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(PackageTable) as any)