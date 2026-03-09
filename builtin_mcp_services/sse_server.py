#!/usr/bin/env python3
"""
SSE 模式的 MCP 服务 - 将所有预置服务暴露为 HTTP API

启动方式: python builtin_mcp_services/sse_server.py [--port 20882]

端点:
- POST /tools/list - 列出所有工具
- POST /tools/call - 调用工具
"""
import asyncio
import json
import random
import sys
import argparse
import re
from typing import Any, Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn


# === 工具定义 ===

# 计算器工具
CALCULATOR_TOOLS = [
    {
        "name": "evaluate",
        "description": "计算数学表达式的值。支持加减乘除、幂运算、括号等。例如：evaluate('8923849+9283/2*33.2') 返回计算结果。这是最常用的计算工具，可以处理复杂的数学表达式。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "要计算的数学表达式，如 '100+200*3/4'"}
            },
            "required": ["expression"]
        }
    },
    {
        "name": "add",
        "description": "计算两个数的和。例如：add(2, 3) = 5",
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "第一个数"},
                "b": {"type": "number", "description": "第二个数"}
            },
            "required": ["a", "b"]
        }
    },
    {
        "name": "subtract",
        "description": "计算两个数的差。例如：subtract(5, 3) = 2",
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "被减数"},
                "b": {"type": "number", "description": "减数"}
            },
            "required": ["a", "b"]
        }
    },
    {
        "name": "multiply",
        "description": "计算两个数的乘积。例如：multiply(4, 5) = 20",
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "第一个数"},
                "b": {"type": "number", "description": "第二个数"}
            },
            "required": ["a", "b"]
        }
    },
    {
        "name": "divide",
        "description": "计算两个数的商。例如：divide(10, 2) = 5。注意：除数不能为0",
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "被除数"},
                "b": {"type": "number", "description": "除数（不能为0）"}
            },
            "required": ["a", "b"]
        }
    },
    {
        "name": "power",
        "description": "计算 a 的 b 次方。例如：power(2, 3) = 8",
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "底数"},
                "b": {"type": "number", "description": "指数"}
            },
            "required": ["a", "b"]
        }
    },
    {
        "name": "sqrt",
        "description": "计算平方根。例如：sqrt(16) = 4",
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "要计算平方根的数（必须非负）"}
            },
            "required": ["a"]
        }
    }
]

# 冷笑话数据
JOKES = {
    "animal": [
        "为什么北极熊不吃企鹅？因为它们一个在北极，一个在南极，太远了！",
        "蜗牛为什么爬得慢？因为它背着房子走！",
        "为什么鱼不会说话？因为它们只会吐泡泡！",
        "长颈鹿为什么脖子长？因为它的脚离头太远了！",
        "为什么企鹅不怕冷？因为它们穿了燕尾服！",
        "为什么蚂蚁看不见自己的脚？因为它们忙着搬家！",
        "为什么猫咪喜欢打瞌睡？因为它们要充电！",
        "海豚为什么总是微笑？因为它们知道人类听不懂它们的笑话！",
        "为什么熊猫总是黑白照片？因为它们没有彩色的生活！",
        "为什么章鱼有8只手？因为它要抢红包！",
    ],
    "food": [
        "西红柿为什么脸红？因为它看见沙拉在换衣服！",
        "包子为什么哭？因为它被蒸了！",
        "为什么饺子总是很团结？因为它们粘在一起！",
        "面包为什么受伤了？因为它被烤了！",
        "为什么鸡蛋不爱出门？因为它怕被打！",
        "为什么火锅总是很热闹？因为它有很多朋友！",
        "薯条为什么自卑？因为它觉得自己太细了！",
        "奶茶为什么受欢迎？因为它知道怎么甜到人心里！",
        "为什么饺子总是很低调？因为它内涵丰富不张扬！",
        "为什么披萨总是很圆？因为它不想有棱角！",
    ],
    "tech": [
        "程序员为什么喜欢深色模式？因为光明的未来太刺眼了！",
        "为什么 Java 开发者戴眼镜？因为他们看不见 C#（C Sharp）！",
        "为什么电脑会发烧？因为它中了病毒！",
        "WiFi 为什么害羞？因为它不善于连接！",
        "为什么键盘不开心？因为它总是被敲打！",
        "为什么程序员分不清万圣节和圣诞节？因为 Oct 31 = Dec 25！",
        "为什么 AI 不讲笑话？因为它们怕被训练数据起诉！",
        "为什么数据库管理员喜欢钓鱼？因为他们在找主键！",
        "为什么 Python 程序员不用电梯？因为他们喜欢递归！",
        "为什么前端开发喜欢喝咖啡？因为需要保持 CSS（Caffeine Styling System）！",
    ],
    "daily": [
        "为什么电风扇会转？因为它晕了！",
        "闹钟为什么响？因为它想叫醒你！",
        "为什么拖鞋不成对？因为它们总是被分开穿！",
        "镜子为什么能照人？因为它脸皮薄！",
        "为什么雨伞能挡雨？因为它脸大！",
        "为什么洗衣机爱转圈？因为它在跳舞！",
        "为什么遥控器总躲在沙发底下？因为它社恐！",
        "为什么手机总是很忙？因为它要处理很多消息！",
        "为什么空调会滴水？因为它哭了！",
        "为什么拖鞋不出国？因为它没有签证！",
    ],
    "random": [
        "小明问妈妈：为什么我的名字叫小明？妈妈说：因为我喜欢明天的太阳。小明说：那哥哥呢？妈妈说：因为他是我明天以前生的，叫小黑。",
        "有一个人去银行取钱，柜台小姐问他要取多少，他说：取钱还要多少？",
        "老师问：谁知道天上的星星为什么眨眼睛？小明答：因为天太黑了，它们怕黑！",
        "病人：医生，我最近总是觉得自己是一张床单。医生：别担心，这只是你的被套行为。",
        "为什么数学书很忧伤？因为它有太多的问题。",
        "为什么钱包越来越瘦？因为它在减肥！",
        "为什么地球不停转动？因为它睡不着！",
        "为什么袜子总少一只？因为它们在玩捉迷藏！",
        "为什么太阳每天都要上班？因为它是正式员工，没有假期！",
        "为什么月亮有时圆有时缺？因为它在减肥，有时吃多有时吃少！",
    ]
}

COLD_JOKES_TOOLS = [
    {
        "name": "get_joke",
        "description": "获取一个随机冷笑话，让人开心一下",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "笑话类别：animal(动物)、food(食物)、tech(科技)、daily(日常)、random(随机)",
                    "enum": ["animal", "food", "tech", "daily", "random"]
                }
            },
            "required": []
        }
    },
    {
        "name": "list_categories",
        "description": "列出所有可用的笑话类别",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_jokes_by_category",
        "description": "获取指定类别的所有笑话",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "笑话类别",
                    "enum": ["animal", "food", "tech", "daily", "random"]
                }
            },
            "required": ["category"]
        }
    }
]


# === 工具执行函数 ===

def execute_calculator_tool(name: str, arguments: Dict[str, Any]) -> str:
    """执行计算器工具"""
    try:
        if name == "evaluate":
            # 计算数学表达式
            expression = arguments.get("expression", "")
            if not expression:
                return "错误: 请提供要计算的表达式"

            # 安全检查：只允许数字、运算符、括号、小数点和空格
            # 移除空格和逗号（数字分隔符）
            clean_expr = expression.replace(" ", "").replace(",", "")

            # 检查是否只包含允许的字符
            if not re.match(r'^[\d+\-*/.()]+$', clean_expr):
                return f"错误: 表达式包含不允许的字符。只支持数字、+-*/、小数点和括号"

            try:
                # 使用 eval 计算表达式（已做安全检查）
                result = eval(clean_expr)
                # 格式化结果（保留合适的小数位数）
                if isinstance(result, float):
                    # 如果是整数结果，显示为整数
                    if result == int(result):
                        result = int(result)
                    else:
                        # 保留最多6位小数，去除末尾的0
                        result = float(f"{result:.6f}".rstrip('0').rstrip('.'))
                return f"计算结果: {expression} = {result:,}" if isinstance(result, int) else f"计算结果: {expression} = {result}"
            except Exception as e:
                return f"计算错误: 表达式 '{expression}' 无法计算 - {str(e)}"

        elif name == "add":
            result = arguments["a"] + arguments["b"]
            return f"计算结果: {arguments['a']} + {arguments['b']} = {result}"
        elif name == "subtract":
            result = arguments["a"] - arguments["b"]
            return f"计算结果: {arguments['a']} - {arguments['b']} = {result}"
        elif name == "multiply":
            result = arguments["a"] * arguments["b"]
            return f"计算结果: {arguments['a']} × {arguments['b']} = {result}"
        elif name == "divide":
            if arguments["b"] == 0:
                return "错误: 除数不能为0"
            result = arguments["a"] / arguments["b"]
            return f"计算结果: {arguments['a']} ÷ {arguments['b']} = {result}"
        elif name == "power":
            result = arguments["a"] ** arguments["b"]
            return f"计算结果: {arguments['a']} ^ {arguments['b']} = {result}"
        elif name == "sqrt":
            if arguments["a"] < 0:
                return "错误: 不能对负数求平方根"
            result = arguments["a"] ** 0.5
            return f"计算结果: √{arguments['a']} = {result}"
        else:
            return f"未知工具: {name}"
    except Exception as e:
        return f"计算错误: {str(e)}"


def execute_joke_tool(name: str, arguments: Dict[str, Any]) -> str:
    """执行冷笑话工具"""
    try:
        if name == "get_joke":
            category = arguments.get("category", "random")
            if category not in JOKES:
                category = "random"
            joke = random.choice(JOKES[category])
            return f"🥶 冷笑话来了：\n\n{joke}\n\n（笑声停不下来...或者根本没开始）"
        elif name == "list_categories":
            categories = list(JOKES.keys())
            descriptions = {
                "animal": "动物相关",
                "food": "食物相关",
                "tech": "科技相关",
                "daily": "日常生活",
                "random": "随机杂烩"
            }
            result = "可用的笑话类别：\n"
            for cat in categories:
                result += f"  • {cat}: {descriptions.get(cat, '')} ({len(JOKES[cat])}条)\n"
            return result
        elif name == "get_jokes_by_category":
            category = arguments.get("category")
            if category not in JOKES:
                return f"未知的类别: {category}。可用类别: {list(JOKES.keys())}"
            jokes = JOKES[category]
            result = f"【{category}】类别的所有笑话：\n\n"
            for i, joke in enumerate(jokes, 1):
                result += f"{i}. {joke}\n\n"
            return result
        else:
            return f"未知工具: {name}"
    except Exception as e:
        return f"获取笑话失败: {str(e)}"


# === FastAPI 应用 ===

app = FastAPI(title="Builtin MCP Services (SSE)")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ToolsListRequest(BaseModel):
    """工具列表请求"""
    pass


class ToolCallRequest(BaseModel):
    """工具调用请求"""
    name: str
    arguments: Dict[str, Any] = {}


class ToolCallResponse(BaseModel):
    """工具调用响应"""
    content: List[Dict[str, str]]


# === Calculator Service ===

@app.post("/calculator/tools/list")
async def calculator_list_tools():
    """计算器服务 - 列出工具"""
    return {"tools": CALCULATOR_TOOLS}


@app.post("/calculator/tools/call")
async def calculator_call_tool(request: ToolCallRequest):
    """计算器服务 - 调用工具"""
    result = execute_calculator_tool(request.name, request.arguments)
    return {"content": [{"type": "text", "text": result}]}


# === Cold Jokes Service ===

@app.post("/cold-jokes/tools/list")
async def cold_jokes_list_tools():
    """冷笑话服务 - 列出工具"""
    return {"tools": COLD_JOKES_TOOLS}


@app.post("/cold-jokes/tools/call")
async def cold_jokes_call_tool(request: ToolCallRequest):
    """冷笑话服务 - 调用工具"""
    result = execute_joke_tool(request.name, request.arguments)
    return {"content": [{"type": "text", "text": result}]}


# === 健康检查 ===

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "services": ["calculator", "cold-jokes"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MCP SSE Server")
    parser.add_argument("--port", type=int, default=20882, help="服务端口")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="服务地址")
    args = parser.parse_args()

    print(f"Starting MCP SSE Server on {args.host}:{args.port}")
    print(f"Services:")
    print(f"  - Calculator: http://{args.host}:{args.port}/calculator")
    print(f"  - Cold Jokes: http://{args.host}:{args.port}/cold-jokes")

    uvicorn.run(app, host=args.host, port=args.port)
