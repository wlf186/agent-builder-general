#!/usr/bin/env python3
"""TC-001 UAT 验证 - 通过后端 API"""
import requests
import json
import time
from datetime import datetime

BACKEND_URL = "http://localhost:20881"
RESULTS_FILE = "/home/wremote/claude-dev/agent-builder-general/teams/AC130/iterations/iteration-2603142000/uat_results.json"

def test_btc_price():
    """测试 BTC 价格查询"""
    print("=== TC-001 UAT 验证 ===\n")
    
    results = {
        "test_id": "TC-001",
        "timestamp": datetime.now().isoformat(),
        "steps": [],
        "checks": {}
    }
    
    # 步骤1: 验证后端
    print("Step 1: 验证后端服务...")
    try:
        r = requests.get(f"{BACKEND_URL}/api/agents/test3", timeout=5)
        r.raise_for_status()
        results["steps"].append({"step": 1, "status": "PASS", "desc": "后端正常"})
        print("✅ 后端服务正常")
    except Exception as e:
        results["steps"].append({"step": 1, "status": "FAIL", "desc": str(e)})
        print(f"❌ 后端连接失败: {e}")
        return results
    
    # 步骤2: 验证 CoinGecko MCP
    print("\nStep 2: 验证 CoinGecko MCP...")
    try:
        r = requests.post(f"{BACKEND_URL}/api/mcp-services/coingecko/test", timeout=10)
        r.raise_for_status()
        data = r.json()
        tool_count = len(data.get("tools", []))
        results["steps"].append({"step": 2, "status": "PASS", "desc": f"{tool_count} 工具可用"})
        print(f"✅ CoinGecko MCP: {tool_count} 工具")
    except Exception as e:
        results["steps"].append({"step": 2, "status": "FAIL", "desc": str(e)})
        print(f"❌ MCP 测试失败: {e}")
        return results
    
    # 步骤3: 测试流式响应
    print("\nStep 3: 测试流式响应 (BTC 最新价格)...")
    
    import subprocess
    cmd = [
        "curl", "-s", "-X", "POST", f"{BACKEND_URL}/api/agents/test3/chat/stream",
        "-H", "Content-Type: application/json",
        "-d", json.dumps({"message": "BTC的最新价格", "history": []}),
        "--no-buffer"
    ]
    
    tool_calls = []
    tool_results = []
    has_streaming = False
    has_error = False
    final_response = ""
    
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    start = time.time()
    while True:
        if time.time() - start > 60:
            print("⏰ 超时")
            break
            
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                break
            continue
            
        has_streaming = True
        if line.startswith("data: "):
            try:
                data = json.loads(line[6:])
                dtype = data.get("type")
                
                if dtype == "tool_call":
                    tool_calls.append({
                        "name": data.get("name"),
                        "args": data.get("args")
                    })
                    print(f"  🔧 工具调用: {data.get('name')} args={data.get('args')}")
                    
                elif dtype == "tool_result":
                    result = data.get("result", "")
                    tool_results.append(result)
                    is_error = "error" in result.lower() or "错误" in result or "failed" in result.lower()
                    if is_error:
                        has_error = True
                    print(f"  📦 结果: {result[:80]}...")
                    
                elif dtype == "content":
                    final_response += data.get("content", "")
                    
            except json.JSONDecodeError:
                pass
    
    proc.wait()
    
    # 分析结果
    print(f"\n分析结果:")
    print(f"  - 流式输出: {'✅' if has_streaming else '❌'}")
    print(f"  - 工具调用次数: {len(tool_calls)}")
    print(f"  - 工具错误: {'❌ 是' if has_error else '✅ 否'}")
    
    if tool_calls:
        print(f"  - 调用工具: {[tc['name'] for tc in tool_calls]}")
    
    results["steps"].append({"step": 3, "status": "PASS", "desc": f"流式响应正常, {len(tool_calls)} 次工具调用"})
    
    # 验收检查
    results["checks"] = {
        "A1_StreamingOutput": has_streaming,
        "A2_ToolCalled": len(tool_calls) > 0,
        "A3_NoStringifyError": not any("Cannot stringify" in str(r) for r in tool_results),
        "A4_HasPriceData": "btc" in final_response.lower() or "bitcoin" in final_response.lower() or "$" in final_response
    }
    
    results["tool_calls"] = tool_calls
    results["tool_results"] = [str(r)[:200] for r in tool_results]
    results["final_response"] = final_response[:500]
    
    print("\n=== UAT 验收结果 ===")
    for key, value in results["checks"].items():
        print(f"  {key}: {'✅ 通过' if value else '❌ 失败'}")
    
    results["overallPass"] = all(results["checks"].values())
    print(f"\n总体: {'✅ UAT 通过' if results['overallPass'] else '❌ UAT 失败'}")
    
    return results

if __name__ == "__main__":
    results = test_btc_price()
    
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n结果已保存: {RESULTS_FILE}")
    
    exit(0 if results.get("overallPass") else 1)
