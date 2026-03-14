"""
循环检测器 - Agent-as-a-Tool 循环依赖检测

| 创建日期 | 2026-03-14 |
|---------|-----------|
| 开发团队 | AC130 |
| 迭代 | 202603142210 |

该模块使用深度优先搜索(DFS)算法检测Agent调用图中的循环依赖。
支持配置时检测和运行时检测两种模式。
"""
from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class CycleInfo:
    """循环信息"""
    has_cycle: bool
    cycle_path: List[str] = field(default_factory=list)
    message: str = ""

    def __bool__(self) -> bool:
        return self.has_cycle


@dataclass
class CallGraph:
    """Agent调用图"""
    nodes: Set[str] = field(default_factory=set)
    edges: Dict[str, Set[str]] = field(default_factory=dict)
    reverse_edges: Dict[str, Set[str]] = field(default_factory=dict)  # 反向边，用于查找谁调用了某个Agent

    def add_node(self, node: str) -> None:
        """添加节点"""
        self.nodes.add(node)
        if node not in self.edges:
            self.edges[node] = set()
        if node not in self.reverse_edges:
            self.reverse_edges[node] = set()

    def add_edge(self, from_node: str, to_node: str) -> None:
        """添加有向边 (from_node -> to_node，表示 from_node 调用 to_node)"""
        self.add_node(from_node)
        self.add_node(to_node)
        self.edges[from_node].add(to_node)
        self.reverse_edges[to_node].add(from_node)

    def get_descendants(self, node: str, visited: Optional[Set[str]] = None) -> Set[str]:
        """获取某个节点的所有后代（被它直接或间接调用的Agent）"""
        if visited is None:
            visited = set()
        if node in visited:
            return set()
        visited.add(node)
        descendants = set()
        for child in self.edges.get(node, set()):
            descendants.add(child)
            descendants.update(self.get_descendants(child, visited))
        return descendants

    def get_ancestors(self, node: str, visited: Optional[Set[str]] = None) -> Set[str]:
        """获取某个节点的所有祖先（直接或间接调用它的Agent）"""
        if visited is None:
            visited = set()
        if node in visited:
            return set()
        visited.add(node)
        ancestors = set()
        for parent in self.reverse_edges.get(node, set()):
            ancestors.add(parent)
            ancestors.update(self.get_ancestors(parent, visited))
        return ancestors

    def to_dict(self) -> Dict:
        """转换为字典格式，用于API响应"""
        return {
            "nodes": sorted(list(self.nodes)),
            "edges": [
                {"from": src, "to": tgt}
                for src, tgts in self.edges.items()
                for tgt in tgts
            ]
        }


class CycleDetector:
    """循环检测器 - 使用DFS检测Agent调用图中的循环"""

    def __init__(self, all_agent_names: List[str]):
        """
        初始化循环检测器

        Args:
            all_agent_names: 系统中所有Agent的名称列表
        """
        self.all_agent_names = set(all_agent_names)
        self.call_graph = CallGraph()

    def build_from_configs(self, configs: Dict[str, List[str]]) -> None:
        """
        从Agent配置构建调用图

        Args:
            configs: 字典，key是Agent名称，value是该Agent的sub_agents列表
        """
        self.call_graph = CallGraph()

        # 添加所有节点
        for agent_name in self.all_agent_names:
            self.call_graph.add_node(agent_name)

        # 添加边
        for agent_name, sub_agents in configs.items():
            for sub_agent in sub_agents:
                if sub_agent in self.all_agent_names:
                    self.call_graph.add_edge(agent_name, sub_agent)

    def detect_cycle(self) -> CycleInfo:
        """
        检测调用图中是否存在循环

        Returns:
            CycleInfo: 包含循环检测结果和路径信息
        """
        # 三色标记法检测循环
        # WHITE = 未访问, GRAY = 访问中（在当前DFS路径上）, BLACK = 已完成访问
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {node: WHITE for node in self.call_graph.nodes}
        parent: Dict[str, Optional[str]] = {}
        cycle_path: List[str] = []

        def dfs(node: str) -> bool:
            """DFS遍历，检测循环"""
            color[node] = GRAY

            for neighbor in self.call_graph.edges.get(node, set()):
                if color[neighbor] == GRAY:
                    # 发现循环！
                    # 重建循环路径
                    cycle_path.clear()
                    cycle_path.append(neighbor)
                    current = node
                    while current != neighbor and current is not None:
                        cycle_path.append(current)
                        current = parent.get(current)
                    cycle_path.append(neighbor)
                    cycle_path.reverse()
                    return True
                elif color[neighbor] == WHITE:
                    parent[neighbor] = node
                    if dfs(neighbor):
                        return True

            color[node] = BLACK
            return False

        # 对所有未访问的节点执行DFS
        for node in self.call_graph.nodes:
            if color[node] == WHITE:
                parent[node] = None
                if dfs(node):
                    return CycleInfo(
                        has_cycle=True,
                        cycle_path=cycle_path,
                        message=f"检测到循环依赖: {' -> '.join(cycle_path)}"
                    )

        return CycleInfo(has_cycle=False)

    def detect_cycle_in_call_stack(
        self,
        agent_name: str,
        call_stack: List[str]
    ) -> CycleInfo:
        """
        运行时检测：检测调用栈中是否形成循环

        Args:
            agent_name: 即将被调用的Agent名称
            call_stack: 当前的调用栈（从根到叶子）

        Returns:
            CycleInfo: 包含循环检测结果和路径信息
        """
        if agent_name in call_stack:
            # 发现循环！
            cycle_start_idx = call_stack.index(agent_name)
            cycle_path = call_stack[cycle_start_idx:] + [agent_name]
            return CycleInfo(
                has_cycle=True,
                cycle_path=cycle_path,
                message=f"运行时检测到循环调用: {' -> '.join(cycle_path)}"
            )

        return CycleInfo(has_cycle=False)

    def validate_config(
        self,
        agent_name: str,
        sub_agents: List[str]
    ) -> CycleInfo:
        """
        验证单个Agent的配置是否会创建循环

        Args:
            agent_name: Agent名称
            sub_agents: 该Agent要调用的子Agent列表

        Returns:
            CycleInfo: 包含循环检测结果和路径信息
        """
        # 创建临时调用图用于验证
        temp_graph = CallGraph()

        # 复制当前调用图
        for node in self.call_graph.nodes:
            temp_graph.add_node(node)
        for src, tgts in self.call_graph.edges.items():
            for tgt in tgts:
                temp_graph.add_edge(src, tgt)

        # 添加新的边
        for sub_agent in sub_agents:
            if sub_agent in self.all_agent_names:
                temp_graph.add_edge(agent_name, sub_agent)

        # 检测循环
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {node: WHITE for node in temp_graph.nodes}
        parent: Dict[str, Optional[str]] = {}
        cycle_path: List[str] = []

        def dfs(node: str) -> bool:
            color[node] = GRAY
            for neighbor in temp_graph.edges.get(node, set()):
                if color[neighbor] == GRAY:
                    cycle_path.clear()
                    cycle_path.append(neighbor)
                    current = node
                    while current != neighbor and current is not None:
                        cycle_path.append(current)
                        current = parent.get(current)
                    cycle_path.append(neighbor)
                    cycle_path.reverse()
                    return True
                elif color[neighbor] == WHITE:
                    parent[neighbor] = node
                    if dfs(neighbor):
                        return True
            color[node] = BLACK
            return False

        for node in temp_graph.nodes:
            if color[node] == WHITE:
                parent[node] = None
                if dfs(node):
                    return CycleInfo(
                        has_cycle=True,
                        cycle_path=cycle_path,
                        message=f"配置会导致循环依赖: {' -> '.join(cycle_path)}"
                    )

        return CycleInfo(has_cycle=False)

    def get_call_graph(self) -> CallGraph:
        """获取当前调用图"""
        return self.call_graph

    def get_agent_summary(self, agent_name: str) -> Dict:
        """
        获取Agent的调用摘要

        Args:
            agent_name: Agent名称

        Returns:
            包含调用关系的摘要字典
        """
        if agent_name not in self.call_graph.nodes:
            return {
                "agent": agent_name,
                "exists": False,
                "sub_agents": [],
                "called_by": [],
                "can_call": [],
                "can_be_called_by": []
            }

        return {
            "agent": agent_name,
            "exists": True,
            "sub_agents": sorted(list(self.call_graph.edges.get(agent_name, set()))),
            "called_by": sorted(list(self.call_graph.reverse_edges.get(agent_name, set()))),
            "can_call": sorted(list(self.call_graph.get_descendants(agent_name))),
            "can_be_called_by": sorted(list(self.call_graph.get_ancestors(agent_name)))
        }


# ============================================================================
# 辅助函数
# ============================================================================

def detect_cycles_from_config(configs: Dict[str, List[str]]) -> Tuple[bool, List[str]]:
    """
    便捷函数：从配置字典检测循环

    Args:
        configs: 字典，key是Agent名称，value是sub_agents列表

    Returns:
        (has_cycle, cycle_messages): 是否有循环和循环信息列表
    """
    agent_names = list(configs.keys())
    detector = CycleDetector(agent_names)
    detector.build_from_configs(configs)

    # 检测是否有循环
    result = detector.detect_cycle()
    if result.has_cycle:
        return True, [result.message]

    return False, []
