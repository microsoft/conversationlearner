/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as Util from '../../Utils/util'
import * as CLM from '@conversationlearner/models'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { FM } from '../../react-intl-messages'
import { conditionDisplay, convertConditionToConditionalTag, isConditionEqual, comparisonTypeDisplay } from '../../Utils/actionCondition'
import './ConditionModal.css'

interface EntityOption extends OF.IDropdownOption {
    data: CLM.EntityBase
}

const convertEntityToDropdownOption = (entity: CLM.EntityBase): EntityOption => {
    let secondaryInfo = entity.entityType === CLM.EntityType.ENUM
        ? `enum`
        : entity.isMultivalue
            ? 'multi'
            : 'single'

    return {
        key: entity.entityId,
        text: `${entity.entityName} - ${secondaryInfo}`,
        data: entity,
    }
}

interface OperatorOption extends OF.IDropdownOption {
    data: CLM.ConditionType
}

const convertConditionTypesToDropdownOptions = (conditionTypes: object): OperatorOption[] => {
    return Object.keys(conditionTypes)
        .map((conditionType: string) => {
            let conditionText = `unknown`
            if (conditionDisplay?.[conditionType]) {
                conditionText = conditionDisplay[conditionType]
            }

            return {
                key: conditionType,
                text: conditionText,
                data: conditionTypes[conditionType],
            }
        })
}

const allOperatorOptions = convertConditionTypesToDropdownOptions(CLM.ConditionType)
// We know EQUAL will be found since it was created from enum type in line above
const equalOperatorOption = allOperatorOptions.find(o => o.data === CLM.ConditionType.EQUAL)!
const stringEqualOperatorOption = allOperatorOptions.find(o => o.data === CLM.ConditionType.STRING_EQUAL)!
const stringEqualOperatorOptions = allOperatorOptions.filter(o => o.data === CLM.ConditionType.STRING_EQUAL)!
const arithmeticOperatorOptions = allOperatorOptions.filter(o => o.data !== CLM.ConditionType.STRING_EQUAL)!
let operatorOptions = allOperatorOptions



interface EnumOption extends OF.IDropdownOption {
    data: CLM.EnumValue
}

// Enum here refers to Enum values on Entities
const convertEnumValueToDropdownOption = (enumValue: CLM.EnumValue): EnumOption => {
    // TODO: Fix types to avoid this. EnumValues on Entities should be guaranteed to exist.
    // Only don't exist during temporary creation
    if (!enumValue.enumValueId) {
        throw new Error(`Enum value must have id. When attempting to convert enum value to dropdown option, value did not have id. Perhaps it was not saved.`)
    }

    return {
        key: enumValue.enumValueId,
        text: enumValue.enumValue,
        data: enumValue,
    }
}

interface ComparisonTypeOption extends OF.IDropdownOption {
    data: CLM.ComparisonType
}

const convertComparisonTypeToDropdownOption = (options: CLM.ComparisonType[]): ComparisonTypeOption[] => {
    return options.map((comparisonType: string) => {
        let conditionText = `unknown`
        if (comparisonTypeDisplay[comparisonType]) {
            conditionText = comparisonTypeDisplay[comparisonType]
        }

        return {
            key: comparisonType,
            text: conditionText,
            data: CLM.ComparisonType[comparisonType],
        }
    })
}


const singleEntityDropdownOptions = convertComparisonTypeToDropdownOption(Object.values(CLM.ComparisonType).filter(t => t !== CLM.ComparisonType.NUMBER_OF_VALUES)) // number of items only valid for multi entities
const multiEntityDropdownOptions = convertComparisonTypeToDropdownOption(Object.values(CLM.ComparisonType).filter(t => t === CLM.ComparisonType.NUMBER_OF_VALUES)) // number of items only valid for multi entities
const enumEntityDropdownOptions = convertComparisonTypeToDropdownOption(Object.values(CLM.ComparisonType).filter(t => t === CLM.ComparisonType.STRING))
let comparisonTypeDropdownOptions = singleEntityDropdownOptions

const stringComparisonTypeOption = singleEntityDropdownOptions.find(o => o.data === CLM.ComparisonType.STRING)!
const numItemsComparisonTypeOption = multiEntityDropdownOptions.find(o => o.data === CLM.ComparisonType.NUMBER_OF_VALUES)!

type Props = InjectedIntlProps
    & {
        condition?: CLM.Condition,
        entities: CLM.EntityBase[],
        isOpen: boolean,
        conditions: CLM.Condition[],
        onClickCreate: (condition: CLM.Condition) => void,
        onClickCancel: () => void,
    }



const Component: React.FC<Props> = (props) => {
    // Entity Dropdown
    const entityOptions = props.entities
        .map(e => convertEntityToDropdownOption(e))
        .sort((a, b) => a.text.localeCompare(b.text))

    const [selectedEntityOption, setSelectedEntityOption] = React.useState(entityOptions[0])
    React.useEffect(() => {
        if (entityOptions.length > 0) {
            setSelectedEntityOption(entityOptions[0])
        }
    }, [props.entities])

    // Operator Dropdown
    const [selectedOperatorOption, setSelectedOperatorOption] = React.useState(equalOperatorOption)

    const setComparisonTypeAndOperator = (option?: EntityOption | undefined) => {
        if (!option) {
            return
        }

        setSelectedEntityOption(option)

        if (option.data.isMultivalue) {
            comparisonTypeDropdownOptions = multiEntityDropdownOptions
            operatorOptions = arithmeticOperatorOptions
            setSelectedComparisonType(numItemsComparisonTypeOption)
            setSelectedOperatorOption(equalOperatorOption)
            setShowStringField(true)
        } else if (option.data.entityType === CLM.EntityType.ENUM) {
            comparisonTypeDropdownOptions = enumEntityDropdownOptions
            operatorOptions = stringEqualOperatorOptions
            setSelectedComparisonType(stringComparisonTypeOption)
            setSelectedOperatorOption(stringEqualOperatorOption)
            setShowStringField(false)
        } else {
            comparisonTypeDropdownOptions = singleEntityDropdownOptions
            operatorOptions = stringEqualOperatorOptions
            setSelectedComparisonType(stringComparisonTypeOption)
            setShowStringField(true)
        }
    }

    const onChangeEntity = (event: React.FormEvent<HTMLDivElement>, option?: EntityOption | undefined, index?: number | undefined) => {
        setComparisonTypeAndOperator(option)
    }


    const onChangeOperator = (event: React.FormEvent<HTMLDivElement>, option?: OperatorOption) => {
        if (!option) {
            return
        }

        setSelectedOperatorOption(option)
    }

    // Comparison Type Dropdown

    const setOperatorOptions = (option?: ComparisonTypeOption) => {
        if (option === stringComparisonTypeOption) {
            operatorOptions = stringEqualOperatorOptions
            setSelectedOperatorOption(stringEqualOperatorOption)
        } else {
            operatorOptions = arithmeticOperatorOptions
            setSelectedOperatorOption(equalOperatorOption)
        }
    }

    const [selectedComparisonType, setSelectedComparisonType] = React.useState(stringComparisonTypeOption)
    const onChangeComparisonType = (event: React.FormEvent<HTMLDivElement>, option?: ComparisonTypeOption) => {
        if (!option) {
            return
        }

        setSelectedComparisonType(option)
        setOperatorOptions(option)
    }

    // Value text field
    const onChangeTextField = (_: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, value: string) => {
        const num = Number(value)
        if (isNaN(num)) {
            setStringValue(value)
        } else {
            setNumberValue(num)
        }
    }

    // String
    const [stringValue, setStringValue] = React.useState('')

    // Value    
    const [numberValue, setNumberValue] = React.useState(0)
    const [enumValueOptions, setEnumValueOptions] = React.useState<EnumOption[]>([])
    const [selectedEnumValueOption, setSelectedEnumValueOption] = React.useState<EnumOption>()
    React.useLayoutEffect(() => {
        if (enumValueOptions.length > 0) {
            setSelectedEnumValueOption(enumValueOptions[0])
        }
    }, [enumValueOptions])

    const onChangeEnumValueOption = (event: React.FormEvent<HTMLDivElement>, option?: EnumOption) => {
        if (!option) {
            return
        }

        setSelectedEnumValueOption(option)
    }

    const [isCreateDisabled, setIsCreateDisabled] = React.useState(false)
    const [showStringField, setShowStringField] = React.useState(false)

    // If entity selected is ENUM show possible values in dropdown
    // Otherwise, show number input
    React.useEffect(() => {
        if (!selectedEntityOption) {
            return
        }

        const entity = selectedEntityOption.data
        if (entity.entityType === CLM.EntityType.ENUM && entity.enumValues) {
            const valueOptions = entity.enumValues.map(ev => convertEnumValueToDropdownOption(ev))
            setEnumValueOptions(valueOptions)
            // Only allow equal operator when selecting enum
            setSelectedOperatorOption(stringEqualOperatorOption)
            setShowStringField(false)
        } else if (!entity.isMultivalue) {
            setSelectedOperatorOption(stringEqualOperatorOption)
            setShowStringField(true)
        }
        // multivalue
        else {
            setSelectedOperatorOption(equalOperatorOption)
            setShowStringField(true)
        }
    }, [selectedEntityOption])

    // If any of inputs change, recompute validity
    React.useEffect(() => {
        const isValid = Boolean(selectedEntityOption)
            && Boolean(selectedOperatorOption)

        setIsCreateDisabled(!isValid)
    }, [selectedEntityOption, selectedOperatorOption, numberValue, selectedEnumValueOption])

    // If condition is present we must be editing
    // Set all options to those on condition
    const condition = props.condition
    React.useEffect(() => {
        if (!condition) {
            return
        }

        const matchingEntityOption = entityOptions.find(eo => eo.data.entityId === condition.entityId)
        if (matchingEntityOption) {
            setSelectedEntityOption(matchingEntityOption)
        }

        // TODO: Fix weird naming, why do conditions objects have condition property?! same with enum value objects
        const matchOperatorOption = allOperatorOptions.find(o => o.data === condition.condition)
        if (matchOperatorOption) {
            setSelectedOperatorOption(matchOperatorOption)
        }

        if (!Util.isNullOrUndefined(condition.valueId)) {
            const matchingEnumOption = enumValueOptions.find(o => o.data.enumValueId === condition.valueId)
            if (matchingEnumOption) {
                setSelectedEnumValueOption(matchingEnumOption)
            }
        }

        if (!Util.isNullOrUndefined(condition.value)) {
            setNumberValue(Number(condition.value))
        }
    }, [props.condition])

    // If modal has opened (from false to true)
    React.useLayoutEffect(() => {
        if (props.isOpen) {
            // Reset operator and value
            setComparisonTypeAndOperator(selectedEntityOption)
        }
    }, [props.isOpen])

    const createConditionFromState = () => {
        if (!selectedEntityOption
            || !selectedOperatorOption) {
            return
        }

        const conditionFromState: CLM.Condition = {
            entityId: selectedEntityOption.data.entityId,
            condition: selectedOperatorOption.data
        }

        if (selectedEntityOption.data.entityType === CLM.EntityType.ENUM) {
            // TODO: Fix enum types
            conditionFromState.valueId = selectedEnumValueOption?.data?.enumValueId!
        }
        else if (selectedOperatorOption === stringEqualOperatorOption) {
            conditionFromState.stringValue = stringValue
        }
        else {
            conditionFromState.value = numberValue
        }

        return conditionFromState
    }

    const onClickCreate = () => {
        const conditionFromState = createConditionFromState()
        if (conditionFromState) {
            props.onClickCreate(conditionFromState)
        }
        else {
            console.warn(`User attempted to create condition but condition did not exist. Usually means there is bad state calculation in modal.`)
        }
    }

    const onClickCancel = () => {
        props.onClickCancel()
    }

    const onClickExistingCondition = (theCondition: CLM.Condition) => {
        props.onClickCreate(theCondition)
    }

    const isOperatorDisabled = (selectedEntityOption?.data.entityType === CLM.EntityType.ENUM) || (selectedComparisonType === stringComparisonTypeOption)

    const conditionsUsingEntity = props.conditions.filter(c => c.entityId === selectedEntityOption?.key)
    const currentCondition = createConditionFromState()


    const isComparisonTypeDisabled = (selectedEntityOption?.data.entityType === CLM.EntityType.ENUM)

    return <OF.Modal
        isOpen={props.isOpen}
        containerClassName="cl-modal cl-modal--medium"
    >
        <div className="cl-modal_header" data-testid="condition-creator-modal-title">
            <span className={OF.FontClassNames.xxLarge}>
                {props.condition
                    ? 'Edit Condition'
                    : 'Create a Condition'}
            </span>
        </div>

        <div className="cl-modal_body">
            <div>
                {entityOptions.length === 0
                    ? <p data-testid="condition-creator-modal-warning" className="cl-text--warning"><OF.Icon iconName='Warning' /> You may only create conditions on enum entities or those with resolver type number which is required. Your model does not have either type available. Please create either of these types of entities to create a condition.</p>
                    : <>
                        <h2 style={{ fontWeight: OF.FontWeights.semibold as number }} className={OF.FontClassNames.large}>Current Condition:</h2>
                        <div className="cl-condition-creator__expression">
                            <OF.Dropdown
                                label="Entity"
                                data-testid="condition-creator-modal-dropdown-entity"
                                selectedKey={selectedEntityOption?.key}
                                disabled={props.condition !== undefined}
                                options={entityOptions}
                                onChange={onChangeEntity}
                            />
                            <OF.Dropdown
                                label="Comparison Type"
                                data-testid="condition-creator-modal-dropdown-comparisontype"
                                selectedKey={selectedComparisonType.key}
                                disabled={isComparisonTypeDisabled}
                                options={comparisonTypeDropdownOptions}
                                onChange={onChangeComparisonType}
                            />
                            <OF.Dropdown
                                label="Operator"
                                data-testid="condition-creator-modal-dropdown-operator"
                                selectedKey={selectedOperatorOption.key}
                                disabled={isOperatorDisabled}
                                options={operatorOptions}
                                onChange={onChangeOperator}
                            />
                            {/* Little awkward to checkEnumValueOption here, but do it for type safety */}
                            {(showStringField || !selectedEnumValueOption)
                                ? <div data-testid="condition-creator-modal-dropdown-numbervalue">
                                    <OF.Label>Value</OF.Label>
                                    <OF.TextField
                                        onChange={onChangeTextField}
                                    />
                                </div>
                                : <OF.Dropdown
                                    label="Enum Value"
                                    data-testid="condition-creator-modal-dropdown-enumvalue"
                                    selectedKey={selectedEnumValueOption.key}
                                    options={enumValueOptions}
                                    onChange={onChangeEnumValueOption}
                                />}
                        </div>

                        <h2 style={{ fontWeight: OF.FontWeights.semibold as number }} className={OF.FontClassNames.large}>Existing Conditions:</h2>
                        <div className="cl-condition-creator__existing-conditions" data-testid="condition-creator-existing-conditions">
                            {conditionsUsingEntity.map(cond => {
                                const conditionalTag = convertConditionToConditionalTag(cond, props.entities)
                                const isActive = currentCondition
                                    ? isConditionEqual(cond, currentCondition)
                                    : false

                                return <React.Fragment key={conditionalTag.key}>
                                    <div
                                        className="cl-condition-creator__existing-condition"
                                        data-testid="condition-creator-modal-existing-condition"
                                    >
                                        {conditionalTag.name}
                                    </div>

                                    <OF.DefaultButton
                                        data-testid="condition-creator-modal-button-use-condition"
                                        onClick={() => onClickExistingCondition(conditionalTag.condition!)}
                                    >
                                        Use Condition
                                    </OF.DefaultButton>

                                    <div>
                                        {isActive
                                            && <OF.Icon
                                                className="cl-text--success"
                                                data-testid="condition-creator-modal-existing-condition-match"
                                                iconName="Accept"
                                            />}
                                    </div>
                                </React.Fragment>
                            })}
                        </div>
                    </>
                }
            </div>
        </div>

        <div className="cl-modal_footer cl-modal-buttons">
            <div className="cl-modal-buttons_secondary" />
            <div className="cl-modal-buttons_primary">
                <OF.PrimaryButton
                    data-testid="condition-creator-button-create"
                    disabled={isCreateDisabled}
                    onClick={onClickCreate}
                    ariaDescription={props.condition
                        ? Util.formatMessageId(props.intl, FM.BUTTON_SAVE_EDIT)
                        : Util.formatMessageId(props.intl, FM.BUTTON_CREATE)}
                    text={props.condition
                        ? Util.formatMessageId(props.intl, FM.BUTTON_SAVE_EDIT)
                        : Util.formatMessageId(props.intl, FM.BUTTON_CREATE)}
                    iconProps={{ iconName: 'Accept' }}
                />

                <OF.DefaultButton
                    data-testid="condition-creator-button-cancel"
                    onClick={onClickCancel}
                    ariaDescription={Util.formatMessageId(props.intl, FM.BUTTON_CANCEL)}
                    text={Util.formatMessageId(props.intl, FM.BUTTON_CANCEL)}
                    iconProps={{ iconName: 'Cancel' }}
                />
            </div>
        </div>
    </OF.Modal>
}

export default injectIntl(Component)