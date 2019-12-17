/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as Util from '../../../Utils/util'
import * as CLM from '@conversationlearner/models'
import actions from '../../../actions'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State, PreBuiltEntities } from '../../../types'
import { CLDropdownOption } from '../CLDropDownOption'
import { FM } from '../../../react-intl-messages'
import { injectIntl, InjectedIntl, InjectedIntlProps } from 'react-intl'
import { withRouter } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
import Component, { IEnumValueForDisplay } from './EntityCreatorComponent'
import { autobind } from 'core-decorators'
import { getUniqueConditions, getUpdatedActionsUsingCondition } from 'src/Utils/actionCondition'
import { NONE_RESOLVER_KEY } from '../../../types/const'

const entityNameMaxLength = 30
const enumMaxLength = 10
const prebuiltPrefix = 'builtin-'

const initState: ComponentState = {
    entityNameVal: '',
    entityTypeVal: CLM.EntityType.LUIS,
    entityResolverVal: NONE_RESOLVER_KEY,
    isPrebuilt: false,
    isMultivalueVal: false,
    isNegatableVal: false,
    isResolutionRequired: false,
    enumValues: [],
    title: '',
    hasPendingChanges: false,
    isConfirmEditModalOpen: false,
    isConfirmDeleteModalOpen: false,
    needPrebuiltWarning: null,
    isDeleteErrorModalOpen: false,
    deleteEnumCheck: null,
    showValidationWarning: false,
    newOrEditedEntity: null,

    isConditionCreatorModalOpen: false,
    conditions: [],
    selectedCondition: undefined,
}

interface ComponentState {
    entityNameVal: string
    entityTypeVal: string
    entityResolverVal: string
    isPrebuilt: boolean
    isMultivalueVal: boolean
    isNegatableVal: boolean
    isResolutionRequired: boolean
    enumValues: (CLM.EnumValue | null)[]
    title: string
    hasPendingChanges: boolean
    isConfirmEditModalOpen: boolean
    isConfirmDeleteModalOpen: boolean
    needPrebuiltWarning: string | null
    isDeleteErrorModalOpen: boolean
    deleteEnumCheck: CLM.EnumValue | null
    showValidationWarning: boolean
    newOrEditedEntity: CLM.EntityBase | null
    isConditionCreatorModalOpen: boolean
    conditions: CLM.Condition[]
    selectedCondition: CLM.Condition | undefined
}

export const getPrebuiltEntityName = (preBuiltType: string): string => {
    return `${prebuiltPrefix}${preBuiltType.toLowerCase()}`
}

class Container extends React.Component<Props, ComponentState> {
    staticEntityOptions: CLDropdownOption[]
    staticResolverOptions: CLDropdownOption[]
    entityOptions: CLDropdownOption[]
    resolverOptions: CLDropdownOption[]

    constructor(props: Props) {
        super(props)
        this.state = { ...initState }
        this.staticEntityOptions = this.getStaticEntityOptions(this.props.intl)
        this.staticResolverOptions = this.getStaticResolverOptions(this.props.intl)
    }

    getStaticEntityOptions(intl: InjectedIntl): CLDropdownOption[] {
        return [
            {
                key: CLM.EntityType.LUIS,
                text: Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_ENTITYOPTION_LUIS),
                itemType: OF.DropdownMenuItemType.Normal,
                style: 'clDropdown--command'
            },
            {
                key: CLM.EntityType.LOCAL,
                text: Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_ENTITYOPTION_PROG),
                itemType: OF.DropdownMenuItemType.Normal,
                style: 'clDropdown--command'
            },
            {
                key: CLM.EntityType.ENUM,
                text: Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_ENTITYOPTION_ENUM),
                itemType: OF.DropdownMenuItemType.Normal,
                style: 'clDropdown--command'
            },
            {
                key: 'divider',
                text: '-',
                itemType: OF.DropdownMenuItemType.Divider,
                style: 'clDropdown--normal'
            },
            {
                key: 'Header',
                text: 'Pre-Trained',
                itemType: OF.DropdownMenuItemType.Header,
                style: 'clDropdown--normal'
            }
        ]
    }

    getStaticResolverOptions(intl: InjectedIntl): CLDropdownOption[] {
        return [
            {
                key: NONE_RESOLVER_KEY,
                text: Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_ENTITY_RESOLVEROPTION_NONE),
                itemType: OF.DropdownMenuItemType.Normal,
                style: 'clDropdown--command'
            }
        ]
    }

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        if (nextProps.open) {
            // If modal is being opened
            if (this.props.open === false) {
                // Build entity options based on current model locale
                const currentAppLocale = nextProps.app.locale
                const preBuiltLocale = PreBuiltEntities.find(entitiesList => entitiesList.locale === currentAppLocale)
                if (!preBuiltLocale) {
                    throw new Error(`Could not find locale: ${currentAppLocale} within list of supported locales: ${PreBuiltEntities.map(e => e.locale).join(', ')}`)
                }

                const localePreBuiltOptions = preBuiltLocale.preBuiltEntities
                    .map<CLDropdownOption>(entityName =>
                        ({
                            key: entityName,
                            text: entityName,
                            itemType: OF.DropdownMenuItemType.Normal,
                            style: 'clDropdown--normal'
                        }))

                if (nextProps.entity === null) {
                    const filteredPreBuiltOptions = localePreBuiltOptions.filter(entityOption => !nextProps.entities.some(e => !e.doNotMemorize && e.entityType === entityOption.key))
                    this.entityOptions = [...this.staticEntityOptions, ...filteredPreBuiltOptions]
                    this.resolverOptions = [...this.staticResolverOptions, ...localePreBuiltOptions]

                    this.setState({
                        ...initState,
                        title: nextProps.intl.formatMessage({
                            id: FM.ENTITYCREATOREDITOR_TITLE_CREATE,
                            defaultMessage: 'Create an Entity'
                        }),
                        entityTypeVal: CLM.EntityType.LUIS,
                        entityResolverVal: (nextProps.entityTypeFilter && nextProps.entityTypeFilter !== CLM.EntityType.LUIS)
                            ? nextProps.entityTypeFilter
                            : NONE_RESOLVER_KEY,
                        enumValues: this.initEnumValues(undefined)
                    })
                } else {
                    this.entityOptions = [...this.staticEntityOptions, ...localePreBuiltOptions]
                    this.resolverOptions = [...this.staticResolverOptions, ...localePreBuiltOptions]
                    const entityType = nextProps.entity.entityType
                    const isPrebuilt = CLM.isPrebuilt(nextProps.entity)
                    const resolverType = nextProps.entity.resolverType === null
                        ? NONE_RESOLVER_KEY
                        : nextProps.entity.resolverType

                    this.setState({
                        entityNameVal: nextProps.entity.entityName,
                        entityTypeVal: entityType,
                        entityResolverVal: resolverType,
                        isPrebuilt: isPrebuilt,
                        isMultivalueVal: nextProps.entity.isMultivalue,
                        isNegatableVal: nextProps.entity.isNegatible,
                        isResolutionRequired: nextProps.entity.isResolutionRequired,
                        title: nextProps.intl.formatMessage({
                            id: FM.ENTITYCREATOREDITOR_TITLE_EDIT,
                            defaultMessage: 'Edit Entity'
                        }),
                        enumValues: this.initEnumValues(nextProps.entity.enumValues),
                    })
                }

            }

            // Recompute conditions while modal is open
            if (nextProps.entity) {
                const entity = nextProps.entity
                const conditions = entity.entityType === CLM.EntityType.LUIS
                    ? getUniqueConditions(this.props.actions)
                        .filter(c => c.entityId === entity.entityId)
                    : []

                this.setState({
                    conditions,
                })
            }
        }
    }

    initEnumValues(enumValues: CLM.EnumValue[] | undefined): (CLM.EnumValue | null)[] {
        if (!enumValues) {
            return Array(CLM.MAX_ENUM_VALUE_COUNT).fill(null)
        }
        const enumClone = Util.deepCopy(enumValues)
        const remaining = Array(CLM.MAX_ENUM_VALUE_COUNT - enumValues.length).fill(null)
        return [...enumClone, ...remaining]
    }

    componentDidUpdate(prevProps: Props, prevState: ComponentState) {
        // If editing resolution option is disabled so preserve value
        // Otherwise,
        // Force changes to isResolutionRequired when resolutionType changes
        // If NONE to other, enabled and true
        // If other to NONE, disabled and false
        if (this.props.entity == null) {
            if (this.state.entityResolverVal !== NONE_RESOLVER_KEY && prevState.entityResolverVal === NONE_RESOLVER_KEY) {
                this.setState({
                    isResolutionRequired: true
                })
            }
            else if (this.state.entityResolverVal === NONE_RESOLVER_KEY && prevState.entityResolverVal !== NONE_RESOLVER_KEY) {
                this.setState({
                    isResolutionRequired: false
                })
            }
        }

        const entity = this.props.entity
        if (!entity) {
            return
        }

        const isResolutionRequiredChanged = this.state.isResolutionRequired !== entity.isResolutionRequired
        const isNameChanged = this.state.entityNameVal !== entity.entityName
        const isMultiValueChanged = this.state.isMultivalueVal !== entity.isMultivalue
        const isNegatableChanged = this.state.isNegatableVal !== entity.isNegatible
        const isResolverChanged = entity.entityType === CLM.EntityType.LUIS && this.state.entityResolverVal !== entity.resolverType
        let hasPendingEnumChanges = false
        if (entity.entityType === CLM.EntityType.ENUM) {
            const newEnums = this.state.enumValues.filter(v => v !== null) as CLM.EnumValue[]
            const oldEnums = entity.enumValues ?? []
            hasPendingEnumChanges = !this.areEnumsIdentical(newEnums, oldEnums)
        }
        const hasPendingChanges = isNameChanged
            || isResolutionRequiredChanged
            || isMultiValueChanged
            || isNegatableChanged
            || isResolverChanged
            || hasPendingEnumChanges

        if (prevState.hasPendingChanges !== hasPendingChanges) {
            this.setState({
                hasPendingChanges
            })
        }
    }

    areEnumsIdentical(newEnums: CLM.EnumValue[], oldEnums: CLM.EnumValue[]): boolean {
        // If any new enums, or old ones changed or deleted
        return newEnums.every(ev => ev.enumValueId !== undefined) &&
            oldEnums.every(oldEnum => {
                const newEnum = newEnums.find(ne => ne.enumValueId === oldEnum.enumValueId)
                return (newEnum !== undefined && newEnum.enumValue === oldEnum.enumValue)
            })
    }

    existingEnumId(value: string): string | undefined {
        if (!this.props.entity || !this.props.entity.enumValues) {
            return undefined
        }
        const enumEntity = this.props.entity.enumValues.find(e => e && e.enumValue === value)
        return enumEntity ? enumEntity.enumValueId : undefined
    }

    convertStateToEntity(state: ComponentState, originalEntity?: CLM.EntityBase): CLM.EntityBase {
        let entityName = this.state.entityNameVal
        const entityType = this.state.entityTypeVal
        const resolverType = this.state.entityResolverVal
        if (this.state.isPrebuilt) {
            entityName = getPrebuiltEntityName(entityType)
        }

        const newOrEditedEntity: CLM.EntityBase = {
            entityId: undefined!,
            entityName,
            resolverType,
            createdDateTime: new Date().toJSON(),
            lastModifiedDateTime: new Date().toJSON(),
            isResolutionRequired: this.state.isResolutionRequired,
            isMultivalue: this.state.isMultivalueVal,
            isNegatible: this.state.isNegatableVal,
            negativeId: null,
            positiveId: null,
            entityType,
            version: null,
            packageCreationId: null,
            packageDeletionId: null,
            // Note: This is set by server when resolver is created, do not change/set on client.
            doNotMemorize: originalEntity
                ? originalEntity.doNotMemorize
                : null
        }

        if (entityType === CLM.EntityType.ENUM) {
            newOrEditedEntity.enumValues = this.state.enumValues.filter(v => v) as CLM.EnumValue[]
        }
        // Set entity id if we're editing existing id.
        if (this.props.entity) {
            newOrEditedEntity.entityId = this.props.entity.entityId

            if (newOrEditedEntity.isNegatible) {
                newOrEditedEntity.positiveId = this.props.entity.positiveId
                newOrEditedEntity.negativeId = this.props.entity.negativeId
            }
        }

        return newOrEditedEntity
    }

    @autobind
    async onClickSaveCreate() {
        const newOrEditedEntity = this.convertStateToEntity(this.state, this.props.entity ? this.props.entity : undefined)

        const needPrebuildWarning = this.newPrebuilt(newOrEditedEntity)
        let needValidationWarning = false

        // If editing check for validation errors
        if (this.props.entity) {
            const appId = this.props.app.appId
            const isMultiValueChanged = this.props.entity ? newOrEditedEntity.isMultivalue !== this.props.entity.isMultivalue : false
            const isNegatableChanged = this.props.entity ? newOrEditedEntity.isNegatible !== this.props.entity.isNegatible : false
            const invalidTrainingDialogIds = await (this.props.fetchEntityEditValidationThunkAsync(appId, this.props.editingPackageId, newOrEditedEntity) as any as Promise<string[]>)
            needValidationWarning = (isMultiValueChanged || isNegatableChanged || (invalidTrainingDialogIds && invalidTrainingDialogIds.length > 0))
        }

        if (needPrebuildWarning || needValidationWarning) {
            this.setState(
                {
                    isConfirmEditModalOpen: needValidationWarning,
                    showValidationWarning: needValidationWarning,
                    needPrebuiltWarning: needPrebuildWarning,
                    newOrEditedEntity: newOrEditedEntity
                })
        }
        // Save and close
        else {
            this.saveAndClose(newOrEditedEntity)
        }
    }

    @autobind
    onClosePrebuiltWarning(): void {
        this.setState({
            showValidationWarning: false
        })
        if (this.state.newOrEditedEntity) {
            this.saveAndClose(this.state.newOrEditedEntity)
        }
    }

    saveAndClose(newOrEditedEntity: CLM.EntityBase) {
        const appId = this.props.app.appId

        const originalEntity = this.props.entity
        if (originalEntity) {
            this.props.editEntityThunkAsync(appId, newOrEditedEntity, originalEntity)
        }
        else {
            this.props.createEntityThunkAsync(appId, newOrEditedEntity)
        }

        this.props.handleClose()
    }

    onClickCancel = () => {
        this.props.handleClose()
    }

    onChangeName = (text: string) => {
        this.setState({
            entityNameVal: text
        })
    }

    onChangeType = (obj: CLDropdownOption) => {
        const isPrebuilt = obj.key !== CLM.EntityType.LUIS && obj.key !== CLM.EntityType.LOCAL && obj.key !== CLM.EntityType.ENUM
        const isNegatableVal = isPrebuilt ? false : this.state.isNegatableVal
        const isMultivalueVal = this.state.isMultivalueVal

        const entityTypeVal = isPrebuilt ? obj.text : obj.key as string
        this.setState(prevState => ({
            isPrebuilt,
            isMultivalueVal,
            isNegatableVal,
            entityTypeVal,
            entityNameVal: isPrebuilt ? getPrebuiltEntityName(obj.text) : prevState.isPrebuilt ? "" : prevState.entityNameVal,
        }))
    }

    onDeleteEnum = (enumValue: CLM.EnumValue) => {
        if (this.isEnumRequiredForActions(enumValue)) {
            this.setState({
                deleteEnumCheck: enumValue
            })
            return
        }
        else {
            this.deleteEnum(enumValue)
        }
    }

    onChangeEnum = (index: number, value: string) => {
        const enumValuesObjs = [...this.state.enumValues]
        const newValue = value.toUpperCase().trim()
        const enumValueObj = enumValuesObjs[index]

        if (newValue.length > 0) {
            // Create new EnumValue if needed
            if (!enumValueObj) {
                enumValuesObjs[index] = { enumValue: newValue }
            }
            // Otherwise set
            else {
                enumValueObj.enumValue = newValue
            }
        }
        else if (enumValueObj) {
            // If existing enum leave blank so error shows
            if (enumValueObj.enumValueId) {
                enumValueObj.enumValue = ""
            }
            // Otherwise just remove the entry
            else {
                enumValuesObjs[index] = null
            }
        }
        this.setState({
            enumValues: enumValuesObjs
        })
    }
    onChangeResolverType = (obj: CLDropdownOption) => {
        this.setState({
            entityResolverVal: obj.key as string
        })
    }
    onChangeResolverResolutionRequired = () => {
        this.setState(prevState => ({
            isResolutionRequired: !prevState.isResolutionRequired,
        }))
    }
    onChangeMultivalue = () => {
        this.setState(prevState => ({
            isMultivalueVal: !prevState.isMultivalueVal,
        }))
    }
    onChangeReversible = () => {
        this.setState(prevState => ({
            isNegatableVal: !prevState.isNegatableVal,
        }))
    }

    onGetNameErrorMessage = (value: string): string => {
        const { intl } = this.props

        if (value.length === 0) {
            return Util.formatMessageId(intl, FM.FIELDERROR_REQUIREDVALUE)
        }

        if (value.length > entityNameMaxLength) {
            return Util.formatMessageId(intl, FM.FIELDERROR_MAX_30)
        }

        if (!/^[a-zA-Z0-9-]+$/.test(value)) {
            return Util.formatMessageId(intl, FM.FIELDERROR_ALPHANUMERIC)
        }

        // Check that name isn't in use
        const entity = this.props.entity
        const otherEntities = entity
            ? this.props.entities
                .filter(e => e.entityId !== entity.entityId)
            : this.props.entities

        const foundEntity = otherEntities.find(e => e.entityName === this.state.entityNameVal)
        if (foundEntity) {
            if (CLM.isPrebuilt(foundEntity)
                && typeof foundEntity.doNotMemorize !== 'undefined'
                && foundEntity.doNotMemorize) {
                return ''
            }
            return Util.formatMessageId(intl, FM.FIELDERROR_DISTINCT)
        }

        if (!this.state.isPrebuilt && (value.toLowerCase().substring(0, prebuiltPrefix.length) === prebuiltPrefix)) {
            return Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_FIELDERROR_RESERVED)
        }

        return ''
    }

    onGetEnumErrorMessage = (enumValue: CLM.EnumValue | null): string => {

        if (!enumValue) {
            return ''
        }

        const { intl } = this.props

        if (enumValue.enumValue.length === 0) {
            // Existing enumvalue can't be blank
            return enumValue.enumValueId ? Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_FIELDERROR_NOBLANK) : ""
        }

        if (enumValue.enumValue.length > enumMaxLength) {
            return Util.formatMessageId(intl, FM.ENTITYCREATOREDITOR_FIELDERROR_ENUM_MAX_LENGTH)
        }

        if (!/^[a-zA-Z0-9-]+$/.test(enumValue.enumValue)) {
            return Util.formatMessageId(intl, FM.FIELDERROR_ALPHANUMERIC)
        }

        if (this.state.enumValues.filter(v => v && v.enumValue === enumValue.enumValueId).length > 1) {
            Util.formatMessageId(intl, FM.FIELDERROR_DISTINCT)
        }

        return ''
    }

    isEnumDuplicate = (value: string): boolean => {
        if (!value) {
            return false
        }
        return (this.state.enumValues.filter(v => v && v.enumValue === value).length > 1)
    }

    @autobind
    async onKeyDownName(event: React.KeyboardEvent<HTMLInputElement>) {
        // On enter attempt to create the entity as long as name is set
        if (event.key === 'Enter' && this.isSaveDisabled() === false) {
            await this.onClickSaveCreate()
        }
    }

    getDisqualifiedActions(): CLM.ActionBase[] {
        const { actions: allActions, entity } = this.props
        return !entity
            ? []
            : allActions.filter(a => a.negativeEntities.some(id => id === entity.entityId))
    }

    getRequiredActions(): CLM.ActionBase[] {
        const { actions: allActions, entity } = this.props
        return !entity
            ? []
            : allActions.filter(a =>
                a.requiredEntities.find(id => id === entity.entityId)
                || a.entityId === entity.entityId)
    }

    onRenderOption = (option: CLDropdownOption): JSX.Element => {
        return (
            <div className="dropdownExample-option">
                <span className={option.style}>{option.text}</span>
            </div>
        )
    }

    isInUse(): boolean {
        return this.isUsedByActions() || this.isUsedByTrainingDialogs()
    }

    isRequiredForActions(): boolean {
        const { actions: allActions, entity } = this.props
        return !entity
            ? false
            : allActions.some(a => [
                ...a.requiredEntitiesFromPayload,
                ...(a.suggestedEntity ? [a.suggestedEntity] : []),
                ...(a.entityId ? [a.entityId] : []),
                ...(a.enumValueId ? [a.enumValueId] : [])
            ].includes(entity.entityId))
    }

    isEnumRequiredForActions(enumValue: CLM.EnumValue): boolean {
        const { actions: allActions, entity } = this.props
        if (!entity) {
            return false
        }

        return allActions.some(a => {
            const usedAsCondition = [...a.requiredConditions, ...a.negativeConditions]
                .some(condition =>
                    condition.entityId === entity.entityId
                    && condition.valueId === enumValue.enumValueId)

            const usedToSetValue = (a.actionType === CLM.ActionTypes.SET_ENTITY)
                && a.entityId === entity.entityId
                && a.enumValueId === enumValue.enumValueId

            return usedAsCondition || usedToSetValue
        })
    }

    isUsedByActions(): boolean {
        const { actions: allActions, entity } = this.props
        return !entity
            ? false
            : allActions.some(a => [...a.negativeEntities, ...a.requiredEntities, ...(a.suggestedEntity ? [a.suggestedEntity] : [])].includes(entity.entityId))
    }

    isUsedByTrainingDialogs(): boolean {
        const { entity } = this.props
        return !entity
            ? false
            : JSON.stringify(this.props.trainDialogs).includes(entity.entityId)
    }

    @autobind
    async onClickDelete() {
        // Check if used by actions (ok if used by TrainDialogs)
        if (this.isRequiredForActions()) {
            this.setState({
                isDeleteErrorModalOpen: true
            })
            return
        }

        if (!this.props.entity) {
            console.warn(`You attempted to delete an entity, but entity prop was not given. This should not be possible. Contact support`)
            return
        }

        try {
            const invalidTrainingDialogIds = await ((this.props.fetchEntityDeleteValidationThunkAsync(this.props.app.appId, this.props.editingPackageId, this.props.entity.entityId) as any) as Promise<string[]>)
            this.setState({
                isConfirmDeleteModalOpen: true,
                showValidationWarning: invalidTrainingDialogIds.length > 0
            })
        }
        catch (e) {
            const error = e as Error
            console.warn(`Error when attempting to validate delete: `, error)
        }
    }

    @autobind
    onCancelDelete() {
        this.setState({
            isConfirmDeleteModalOpen: false,
            isDeleteErrorModalOpen: false
        })
    }

    @autobind
    onCancelEnumDelete() {
        this.setState({
            deleteEnumCheck: null
        })
    }

    @autobind
    onConfirmEnumDelete() {
        if (this.state.deleteEnumCheck) {
            this.deleteEnum(this.state.deleteEnumCheck)
        }
        this.setState({
            deleteEnumCheck: null
        })
    }

    @autobind
    onConfirmDelete() {
        const entity = this.props.entity
        if (!entity) {
            console.warn(`You confirmed delete, but the entity prop was not provided. This should not be possible. Contact Support`)
            return
        }

        this.setState({
            isConfirmDeleteModalOpen: false
        }, () => {
            this.props.handleDelete(entity)
        })
    }

    @autobind
    onCancelEdit() {
        this.setState({
            isConfirmEditModalOpen: false,
            newOrEditedEntity: null
        })
    }

    newPrebuilt(newOrEditedEntity: CLM.EntityBase): string | null {
        // Check resolvers
        if (newOrEditedEntity.resolverType && newOrEditedEntity.resolverType !== "none") {

            const resolverType = newOrEditedEntity.resolverType
            const existingBuiltIn = this.props.entities.find(e =>
                e.resolverType === resolverType ||
                e.entityType === resolverType)

            if (!existingBuiltIn) {
                return resolverType
            }
        }

        // Check prebuilts
        if (this.state.isPrebuilt) {

            // If a prebuilt - entity name is prebuilt name
            const existingBuiltIn = this.props.entities.find(e =>
                e.resolverType === newOrEditedEntity.entityType ||
                e.entityType === newOrEditedEntity.entityType)

            if (!existingBuiltIn) {
                return newOrEditedEntity.entityName
            }
        }
        return null
    }

    @autobind
    onConfirmEdit() {
        if (!this.state.newOrEditedEntity) {
            console.warn(`You confirmed the edit, but the newOrEditedEntity state was not available. This should not be possible. Contact Support`)
            return
        }

        this.setState({
            isConfirmEditModalOpen: false,
            newOrEditedEntity: null
        })

        if (!this.state.needPrebuiltWarning) {
            this.saveAndClose(this.state.newOrEditedEntity)
        }
    }

    @autobind
    onClickTrainDialogs() {
        const { history } = this.props
        history.push(`/home/${this.props.app.appId}/trainDialogs`, { app: this.props.app, entityFilter: this.props.entity })
    }

    isSaveDisabled() {
        if (this.state.entityTypeVal === CLM.EntityType.ENUM) {
            // Enum must have at least 2 values
            const values = this.state.enumValues.filter(v => v)
            if (values.length < 2) {
                return true
            }
            const invalid = this.state.enumValues.filter(v => v && (this.onGetEnumErrorMessage(v) || this.isEnumDuplicate(v.enumValue)))
            if (invalid.length > 0) {
                return true
            }
        }
        return (this.onGetNameErrorMessage(this.state.entityNameVal) !== '')
    }

    @autobind
    onClickEditCondition(condition: CLM.Condition) {
        this.setState({
            isConditionCreatorModalOpen: true,
            selectedCondition: condition,
        })
    }

    @autobind
    async onClickCreateConditionCreator(condition: CLM.Condition) {
        // Should always be true, but need to check
        if (this.state.selectedCondition) {
            const actionsUsingCondition = getUpdatedActionsUsingCondition(this.props.actions, this.state.selectedCondition, condition)
            for (const action of actionsUsingCondition) {
                this.props.editActionThunkAsync(this.props.app.appId, action)
            }
        }

        this.setState({
            isConditionCreatorModalOpen: false,
            selectedCondition: undefined,
        })
    }

    @autobind
    onClickCancelConditionCreator() {
        this.setState({
            isConditionCreatorModalOpen: false,
            selectedCondition: undefined,
        })
    }

    render() {
        const { intl } = this.props
        // const isEntityInUse = this.state.isEditing && this.isInUse()

        const title = this.props.entity
            ? this.props.entity.entityName
            : this.state.title

        const name = this.state.isPrebuilt
            ? getPrebuiltEntityName(this.state.entityTypeVal)
            : this.state.entityNameVal

        const isSaveButtonDisabled = this.isSaveDisabled()
            || (!!this.props.entity && !this.state.hasPendingChanges)

        const enumValues = this.state.enumValues
            .map<IEnumValueForDisplay | null>(ev => {
                if (!ev) {
                    return null
                }

                let allowDelete = true
                const entity = this.props.entity
                if (entity && ev.enumValueId) {
                    const action = this.props.actions.find(a => a.actionType === CLM.ActionTypes.SET_ENTITY
                        && a.entityId === entity.entityId
                        && a.enumValueId === ev.enumValueId)

                    if (action) {
                        allowDelete = false
                    }
                }

                return {
                    ...ev,
                    allowDelete
                }
            })

        const isEditing = this.props.entity != null

        return <Component
            open={this.props.open}
            title={title}
            intl={intl}
            entityOptions={this.entityOptions}

            entityTypeKey={this.state.entityTypeVal}
            isTypeDisabled={isEditing || this.props.entityTypeFilter != null}
            onChangeType={this.onChangeType}

            entity={this.props.entity ? this.props.entity : undefined}
            name={name}
            isNameDisabled={this.state.isPrebuilt}
            onGetNameErrorMessage={this.onGetNameErrorMessage}
            onChangeName={this.onChangeName}
            onKeyDownName={this.onKeyDownName}

            isMultiValue={this.state.isMultivalueVal}
            isMultiValueDisabled={false}
            onChangeMultiValue={this.onChangeMultivalue}

            isNegatable={this.state.isNegatableVal}
            onChangeNegatable={this.onChangeReversible}

            isEditing={isEditing}
            requiredActions={this.getRequiredActions()}
            disqualifiedActions={this.getDisqualifiedActions()}

            onClickTrainDialogs={this.onClickTrainDialogs}

            isSaveButtonDisabled={isSaveButtonDisabled}
            onClickSaveCreate={this.onClickSaveCreate}

            onClickCancel={this.onClickCancel}

            isConfirmDeleteModalOpen={this.state.isConfirmDeleteModalOpen}
            isDeleteErrorModalOpen={this.state.isDeleteErrorModalOpen}
            showDelete={isEditing && !!this.props.handleDelete}
            onClickDelete={this.onClickDelete}
            onCancelDelete={this.onCancelDelete}
            onConfirmDelete={this.onConfirmDelete}

            isConfirmEditModalOpen={this.state.isConfirmEditModalOpen}
            onCancelEdit={this.onCancelEdit}
            onConfirmEdit={this.onConfirmEdit}

            showValidationWarning={this.state.showValidationWarning}

            needPrebuiltWarning={this.state.needPrebuiltWarning}
            onClosePrebuiltWarning={this.onClosePrebuiltWarning}

            selectedResolverKey={this.state.entityResolverVal}
            resolverOptions={this.resolverOptions}
            onChangeResolver={this.onChangeResolverType}

            isResolutionRequired={this.state.isResolutionRequired}
            onChangeResolverResolutionRequired={this.onChangeResolverResolutionRequired}

            isConditionCreatorModalOpen={this.state.isConditionCreatorModalOpen}
            conditions={this.state.conditions}
            selectedCondition={this.state.selectedCondition}
            onClickEditCondition={this.onClickEditCondition}
            onClickCancelConditionCreator={this.onClickCancelConditionCreator}
            onClickCreateConditionCreator={this.onClickCreateConditionCreator}

            enumValues={enumValues}
            onChangeEnum={this.onChangeEnum}
            onGetEnumErrorMessage={this.onGetEnumErrorMessage}
            onDeleteEnum={this.onDeleteEnum}
            onCancelEnumDelete={this.onCancelEnumDelete}
            onConfirmEnumDelete={this.onConfirmEnumDelete}
            deleteEnumCheck={this.state.deleteEnumCheck}
        />
    }

    private deleteEnum(enumValue: CLM.EnumValue): void {
        const index = this.state.enumValues.findIndex(ev => ev ? ev.enumValueId === enumValue.enumValueId : false)
        if (index >= 0) {
            const enumValues = [...this.state.enumValues]
            enumValues[index] = null
            this.setState({ enumValues })
        } else {
            console.error(`DeleteEnum: Invalid Index`)
        }
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        createEntityThunkAsync: actions.entity.createEntityThunkAsync,
        editEntityThunkAsync: actions.entity.editEntityThunkAsync,
        editActionThunkAsync: actions.action.editActionThunkAsync,
        fetchEntityDeleteValidationThunkAsync: actions.entity.fetchEntityDeleteValidationThunkAsync,
        fetchEntityEditValidationThunkAsync: actions.entity.fetchEntityEditValidationThunkAsync
    }, dispatch)
}
const mapStateToProps = (state: State, ownProps: any) => {
    return {
        entities: state.entities,
        actions: state.actions,
        trainDialogs: state.trainDialogs
    }
}

export interface ReceivedProps {
    app: CLM.AppBase,
    editingPackageId: string,
    open: boolean,
    entity: CLM.EntityBase | null,
    entityTypeFilter: CLM.EntityType | null
    handleClose: () => void,
    handleDelete: (entity: CLM.EntityBase) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps & RouteComponentProps<any>

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(withRouter(injectIntl(Container)))