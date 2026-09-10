# Session Graph

Session Graph helps a person understand, navigate, arrange, and branch the lineage of DeepSeek Harness sessions related to the session they are viewing. It is a derived projection; DeepSeek Harness remains authoritative for sessions, workspaces, lineage, and activity.

Research Topics are separate Host-owned collections of references. The plugin owns their names, membership, and arrangements; it does not take ownership of the Sessions those references address.

Knowledge Cards are Host-owned, editable research results with immutable revisions and retained discussion sources. They participate in Topic Graphs without becoming Sessions or creating Session Lineage.

## Language

### Scope

**Viewed Session**:
The session whose conversation hosts the Graph view. It anchors the graph's scope and is the session treated as current by the view.
_Avoid_: Current session, active session

**Selected Session**:
A Canvas Session chosen inside the graph for inspection or an explicit action. Selecting it does not change the Viewed Session.
_Avoid_: Current session, opened session

**Workspace**:
A named Harness grouping with a canonical working directory and an accounted set of sessions.
_Avoid_: Project, directory, Workspace Scope

**Workspace Scope**:
The named graph scope resolved for the Viewed Session, preferring formal Workspace membership over a matching working directory. It contains non-archived sessions accounted to that Workspace or sharing its working directory.
_Avoid_: Project scope, current directory

**Directory Scope**:
The unnamed fallback scope containing non-archived sessions that share the Viewed Session's working directory when no Workspace matches.
_Avoid_: Untitled Workspace, loose Workspace

**Unscoped Session**:
A Viewed Session for which neither a Workspace nor a working directory can be resolved, so no Session Graph can be formed.
_Avoid_: Outside-Workspace Session

### Sessions and relationships

**Session Graph**:
The scope-bound projection of Canvas Sessions, Branches, Session Clusters, and Subagent Summaries. It is not a separately owned source of session data.
_Avoid_: Stored graph, global graph, message graph

**Canvas Session**:
A non-subagent session eligible to appear individually in the Session Graph. Archived sessions and blank sessions other than the Viewed Session are not Canvas Sessions in that graph.
_Avoid_: Ordinary session, normal session, row

**Blank Session**:
A session whose conversation has no established content. It is included only when it is also the Viewed Session.
_Avoid_: Empty node, placeholder

**Display Status**:
The single activity label presented for a Canvas Session. When activity facts overlap, Running takes precedence over Waiting for Input, which takes precedence over Completed.
_Avoid_: Session lifecycle state, combined status

**Session Lineage**:
Parent-child ancestry among sessions, encompassing both Branches and Subagent Derivations.
_Avoid_: Branch tree, derivation tree

**Branch**:
A directed lineage relation from one Canvas Session to a child Canvas Session. Creating a Branch produces a distinct session without changing the source session.
_Avoid_: Fork, Subagent Derivation

**Merge Session**:
An independent Canvas Session with no parent Session, initialized from an explicit instruction and immutable snapshots of two or three source sessions. At capture time it is either blank or already bound to the exact same ordered Merge Sources by its first Merge marker, which makes retry idempotent. It is not a Branch, and its creation does not change its sources.
_Avoid_: Aggregated session, merged branch, combined thread

**Merge Source**:
A Canvas Session selected to contribute one snapshot to a Merge Session. At submission time the Host confirms that every source is non-blank, non-archived, not a Subagent Session, and shares the target working directory; browser metadata is never authoritative for eligibility.
_Avoid_: Parent session, input branch

**Session Snapshot**:
An immutable view of one Merge Source through a recorded event boundary. Later source activity does not alter the snapshot already used by a Merge Session.
_Avoid_: Live reference, copied session

**Merge Relation**:
A directed many-to-one relationship from each Merge Source to its Merge Session. It records provenance without creating Session Lineage or changing Session Cluster membership.
_Avoid_: Branch, parent relation, Subagent Derivation

**Subagent Derivation**:
A directed lineage relation whose child is a Subagent Session. It is summarized under a Canvas Session rather than represented as a Branch.
_Avoid_: Branch, fork

**Subagent Session**:
A session created with subagent origin to perform delegated work. It does not appear individually in the Session Graph.
_Avoid_: Agent node, hidden Branch

**Subagent Summary**:
The total number of Subagent Sessions, including the running subset, reachable from one Canvas Session through an uninterrupted chain of Subagent Derivations. A Branch boundary starts a separate summary for the branch session.
_Avoid_: Subagent node, branch count

**Root Session**:
A Canvas Session with no Canvas Session parent in the current graph. Root status is scope-relative, so a session whose parent is a Subagent Session or is absent from the graph is also a Root Session.
_Avoid_: Original session, first session

**Session Cluster**:
A Root Session together with every Canvas Session reachable from it through Branches. Every Canvas Session belongs to exactly one Session Cluster, including a Root Session with no branches.
_Avoid_: Workspace, derivation tree, group

**Branch Lineage**:
A Canvas Session together with its Branch ancestors and Branch descendants. Sibling branches are outside one another's Branch Lineage.
_Avoid_: Session Cluster, neighborhood

### Arrangement and discovery

**Knowledge Card**:
A durable identity for a conclusion, method, hypothesis, or question on one Host. Its latest revision is searchable by title and body; membership in Research Topics is explicit and independent of source directories. Removing membership, Reset, or layout cleanup does not delete the card.
_Avoid_: Session Digest, Canvas Session, copied session

**Card Revision**:
One immutable saved version of a Knowledge Card's text, type, draft/confirmed status, and sources. Editing appends a revision; retrying the identical save identity is idempotent. Historical references retain the addressed revision even after later edits.
_Avoid_: Mutable draft, Session Snapshot, latest content

**Knowledge Source**:
A Discussion Source captured by the Host at exact completed turn boundaries when a Card Revision is saved. It retains Session identity, display labels, event boundaries, dates, and readable user/assistant excerpts. Original reading prefers those exact boundaries and clearly distinguishes retained excerpts when the original is unavailable.
_Avoid_: Verified conclusion, tool evidence, similar text

**Source Relation**:
A directed provenance link from an addressed Session to a Knowledge Card. Its saved revision records the precise Knowledge Sources. It does not create a Branch or Merge Relation, add model context, or imply that the source is a member of the Research Topic.
_Avoid_: Branch, Merge Relation, Topic Reference

**Research Topic**:
A named collection with a stable identity on one Host, containing references to Sessions across Workspaces. One Session can belong to several topics. Topic membership and arrangement survive Host restart without changing Session ownership, archive state, lineage, or model context.
_Avoid_: Workspace, Session Cluster, merged context

**Topic Reference**:
A durable Session identity within a Research Topic, with display labels retained for unavailable sources. Archiving or losing access to the source does not remove this reference. Original discussion remains in Harness and is read on demand.
_Avoid_: Session Snapshot, copied discussion, knowledge card

**Topic Graph**:
The projection of a Research Topic's references, including archived and unavailable sources. It shows only Branch and Merge relations supported by Harness facts. Being visible here does not make a source a Canvas Session in a Workspace Scope.
_Avoid_: Global graph, Workspace Scope, Session Cluster

**Session Arrangement**:
The placement and collapse choices a person applies to one graph scope; they change presentation only, never Session Lineage or activity. Each Workspace Scope owns a separate Session Arrangement even when Workspaces share a directory, while a Directory Scope owns the arrangement for its directory. Each Research Topic owns a separately saved arrangement in Host storage; Reset and Relayout affect presentation, not its Topic References.
_Avoid_: Session state, graph data

**Collapsed Cluster**:
A Session Cluster shown in compact form while retaining all of its Canvas Sessions. Collapse is not filtering, hiding, or archiving.
_Avoid_: Hidden cluster, archived cluster

**Relayout**:
The action that restores automatic positions while preserving which Session Clusters are collapsed.
_Avoid_: Reset

**Reset**:
The action that discards the complete Session Arrangement, expands every Session Cluster, and fits the resulting graph into view.
_Avoid_: Relayout

**Title Filter**:
A case-insensitive title match that emphasizes matching Canvas Sessions without changing scope or graph membership.
_Avoid_: Search, session filter

**Session Inspector**:
The persistent detail panel for the Selected Session, or the addressed source while Discussion Search or a Research Topic is open. Selection and reading remain local to their view. A Topic's source inspector exposes original reading, explicit navigation, and reference removal. It remains authoritative while another Session is only being previewed.
_Avoid_: Hover card, current-session panel

**Session Digest**:
An explicitly requested, model-generated, read-only digest of one Canvas Session at one source revision. It presents a short overview, key outcomes, and open items inside the Session Inspector. A newer source revision makes an existing digest stale without hiding it. Session Digests never enter the Session log or change Session Lineage.
_Avoid_: Session Summary, Subagent Summary, compaction summary, generated message

**Session Preview**:
A transient, delayed summary shown while dwelling on a Canvas Session other than the Selected Session. It never changes selection.
_Avoid_: Inspector, tooltip

**Session History**:
The read-only user/assistant discussion text of one Selected Session or addressed search result, inspected on demand through Harness and presented in the Inspector. It is neither generated nor persisted by the plugin. Its source state distinguishes available original text, a retained excerpt, and an unavailable source.
_Avoid_: Session Digest, chat replica, stored graph

**Discussion Turn**:
A discussion unit identified by its Session and `turn/start` event sequence, with a fixed `turn/end` boundary when completed. Only completed turns expose text as selectable source material; an unfinished turn exposes status until refreshed after completion. Titles and matching text are not identities.
_Avoid_: Message, model step, text match

**Discussion Search**:
An explicit, read-only keyword search over completed direct user/assistant discussion on the connected Host. Workspace or directory scope and archive inclusion constrain candidates before ranking and pagination. A result addresses its Session, matching message event, and Discussion Turn start; inspecting it does not select a Canvas Session or change the Viewed Session. Archived and cross-workspace results can be read without becoming eligible for the current graph.
_Avoid_: Title Filter, semantic search, global graph

**Discussion Source**:
A continuous selection of completed Discussion Turns from one Session, addressed by exact start/end event sequences and accompanied by a fallback excerpt. The Original reader retains it only in memory while open. Rechecking prefers the original; an unavailable original never turns the excerpt into verified source text.
_Avoid_: Session Snapshot, saved knowledge card, live reference

**Session Terminal**:
A stable visual connection seat exposed above and below every Canvas Session card. The top seat is the Input Terminal and the bottom seat is the Output Terminal. Terminals are currently non-interactive and do not themselves create or change Session Lineage.
_Avoid_: Branch, Subagent Derivation, connector node
