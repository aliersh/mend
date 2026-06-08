import { GroupCreated } from '../generated/PontiFactory/PontiFactory'
import { PontiGroup } from '../generated/templates'
import { Group } from '../generated/schema'

export function handleGroupCreated(event: GroupCreated): void {
  let group = new Group(event.params.group.toHexString())
  group.memberA = event.params.memberA
  group.memberB = event.params.memberB
  group.createdAt = event.block.timestamp
  group.createdBlock = event.block.number
  group.save()

  // Spawn a template instance so this group's events get indexed.
  // event.params.group is the newly deployed PontiGroup contract address.
  PontiGroup.create(event.params.group)
}
