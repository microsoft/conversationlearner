import * as graph from './graph'
import * as CLM from '@conversationlearner/models'

const getHashDataFromTrainRound = (round: CLM.TrainRound): object => {
    return {
        filledEntityIds: round.scorerSteps[0].input.filledEntities.map(fe => fe.entityId),
        scorerActionsIds: round.scorerSteps.map(ss => ss.labelAction!),
    }
}

export const getNodes = (dialog: CLM.TrainDialog): graph.Node[] => {
    const nodes = dialog.rounds
        .map((round, i) => {
            // Convert each round to node

            // Extract data which makes node unique to object to be hashed
            const hashData = getHashDataFromTrainRound(round)
            const node = graph.getNode(round, hashData)

            // console.log(`Node: `, round.extractorStep.textVariations.map(tv => tv.text), hashData, node)
            return node
        })

    return nodes
}

type Model = {
    entities: CLM.EntityBase[],
    actions: CLM.ActionBase[],
}

export const getLabelFromNode = (model: Model) => (n: graph.Node<CLM.TrainRound>): string => {
    // First node is extractor + scorer
    const round = n.data
    const extractorText = round.extractorStep.textVariations
        .map(tv => tv.text)

    const defaultEntityMap = new Map<string, string>()

    const firstFilledEntities = round.scorerSteps[0].input.filledEntities
        ; (model.entities as CLM.EntityBase[]).forEach(e => {

            const filledEntity = firstFilledEntities
                .find(fe => fe.entityId === e.entityId)

            const filledEntityValues = filledEntity
                ? `[${filledEntity.values.map(v => v.displayText).join(', ')}]`
                : `$${e.entityName}`

            defaultEntityMap.set(e.entityId, filledEntityValues)
        })
    const scorerStepsText = round.scorerSteps
        .map(ss => (model.actions as CLM.ActionBase[]).find(a => a.actionId === ss.labelAction)!)
        .map(a => CLM.ActionBase.GetPayload(a, defaultEntityMap))

    const hashData = getHashDataFromTrainRound(round)

    const text = `
Node ID: ${n.id.substr(0, 13)}
 
${extractorText.map(t => `User: ${t}`).join('\n')}
${scorerStepsText.map(t => `Bot: ${t}`).join("\n")}
 
Hash: ${n.hash.substr(0, 10)}
Hash Data: ${JSON.stringify(hashData, null, '  ')}
`

    return text
}

export const mergeNodeData = (n1: graph.Node<CLM.TrainRound>, n2: graph.Node<CLM.TrainRound>): graph.Node<CLM.TrainRound> => {
    // Add text variations from n2 to n1
    n1.data.extractorStep.textVariations.push(...n2.data.extractorStep.textVariations)

    return n1
}
