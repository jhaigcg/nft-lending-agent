import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";

import { nftMetadataTool } from "../tools/nft-data";
import { rarityAnalysisTool } from "../tools/rarity";
import { ltvCalculatorTool } from "../tools/ltv-calculator";
import { reportGeneratorTool } from "../tools/report-generator";

const tools = [
  nftMetadataTool,
  rarityAnalysisTool,
  ltvCalculatorTool,
  reportGeneratorTool,
] as any[];

const model = new ChatOpenAI({
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL || "http://localhost:8000/v1",
  },
  model: "llama-3.2-3b-instruct",
  temperature: 0.1,
  apiKey: process.env.OPENAI_API_KEY || "not-needed",
}) as any;

const boundModel = model.bindTools(tools);

interface AgentState {
  messages: BaseMessage[];
  nftData?: string;
  rarityScore?: string;
  loanEstimate?: string;
  report?: string;
}

// Reducer for optional string state: prefer new value if defined
const optionalStringReducer = (
  left: string | undefined,
  right: string | undefined
): string | undefined => (right !== undefined ? right : left);

// Define state channels properly to persist data between nodes
const workflow = new StateGraph<AgentState>({
  channels: {
    messages: {
      value: (left: BaseMessage[] = [], right: BaseMessage[] = []) => [...left, ...right],
      default: () => [],
    },
    nftData: { value: optionalStringReducer, default: () => undefined },
    rarityScore: { value: optionalStringReducer, default: () => undefined },
    loanEstimate: { value: optionalStringReducer, default: () => undefined },
    report: { value: optionalStringReducer, default: () => undefined },
  }
})
  .addNode("agent", async (state: AgentState) => {
    console.error("🤖 Agent thinking...");
    try {
      const response = await boundModel.invoke(state.messages);
      return { 
        messages: [response],
        // Preserve existing state
        nftData: state.nftData,
        rarityScore: state.rarityScore,
        loanEstimate: state.loanEstimate,
        report: state.report,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? (error as Error).message : String(error);
      console.error("❌ Agent error:", msg);
      return { 
        messages: state.messages,
        nftData: state.nftData,
        rarityScore: state.rarityScore,
        loanEstimate: state.loanEstimate,
        report: state.report,
      };
    }
  })
  
  .addNode("tools", async (state: AgentState) => {
    console.error("🛠️ Executing tools...");
    
    const lastMessage = state.messages[state.messages.length - 1] as any;
    const toolCalls = lastMessage?.tool_calls || [];
    const newMessages: BaseMessage[] = [];
    
    // Create updated state object
    let updatedState = { ...state };
    
    for (const toolCall of toolCalls) {
      console.error(`  - Calling: ${toolCall.name}`);
      let result: string = "";
      
      try {
        switch (toolCall.name) {
          case "get_nft_metadata":
            result = await nftMetadataTool.invoke(toolCall.args);
            updatedState.nftData = result;
            console.error(`   ✅ NFT data stored, length: ${result.length}`);
            break;
            
          case "analyze_rarity": {
            const args = { ...toolCall.args };
            if (!args.traits && updatedState.nftData) {
              try {
                const nft = JSON.parse(updatedState.nftData);
                args.traits = JSON.stringify(nft.traits || []);
                args.floorPrice = nft.floorPrice || 0.1;
                args.collectionName = nft.collectionName || "Unknown";
                console.error(`   📋 Using traits from NFT data: ${nft.traits?.length || 0} traits`);
              } catch (e: unknown) {
                console.error("Error parsing nftData:", e instanceof Error ? e.message : String(e));
              }
            }
            result = await rarityAnalysisTool.invoke(args);
            updatedState.rarityScore = result;
            console.error(`   ✅ Rarity score stored, length: ${result.length}`);
            break;
          }
          
          case "calculate_loan_estimate": {
            const args = { ...toolCall.args };
            if (updatedState.nftData && updatedState.rarityScore) {
              try {
                const nft = JSON.parse(updatedState.nftData);
                const rarity = JSON.parse(updatedState.rarityScore);
                args.floorPrice = nft.floorPrice || 0.1;
                args.rarityPremium = rarity.estimatedPremium || 0;
                console.error(`   💰 Using floor price: ${args.floorPrice} ETH, premium: ${args.rarityPremium}%`);
              } catch (e: unknown) {
                console.error("Error parsing data for LTV:", e instanceof Error ? e.message : String(e));
              }
            }
            result = await ltvCalculatorTool.invoke(args);
            updatedState.loanEstimate = result;
            
            // Log the loan amount for debugging
            try {
              const loan = JSON.parse(result);
              console.error(`   ✅ Loan calculated: $${loan.recommendedLoanUsdt} at ${loan.ltvRatio}% LTV`);
            } catch (e) {}
            break;
          }
          
          case "generate_lending_report": {
            console.error("📊 Preparing report with state data:");
            console.error(`   - nftData exists: ${!!updatedState.nftData} (length: ${updatedState.nftData?.length || 0})`);
            console.error(`   - rarityScore exists: ${!!updatedState.rarityScore} (length: ${updatedState.rarityScore?.length || 0})`);
            console.error(`   - loanEstimate exists: ${!!updatedState.loanEstimate} (length: ${updatedState.loanEstimate?.length || 0})`);
            
            // Log the actual loan amount if available
            if (updatedState.loanEstimate) {
              try {
                const loan = JSON.parse(updatedState.loanEstimate);
                console.error(`   💰 Loan amount from state: $${loan.recommendedLoanUsdt}`);
              } catch (e) {
                console.error("   ⚠️ Could not parse loanEstimate");
              }
            }
            
            // Ensure we're passing the actual state data, not defaults
            const reportArgs = {
              ...toolCall.args,
              nftData: updatedState.nftData || JSON.stringify({ 
                collectionName: "Unknown", 
                tokenId: "Unknown",
                traits: [],
                imageUrl: "",
                contract: "",
                floorPrice: 0.1
              }),
              rarityScore: updatedState.rarityScore || JSON.stringify({ 
                overallRarity: 50, 
                percentile: 50, 
                estimatedPremium: 25,
                rareTraits: [] 
              }),
              loanEstimate: updatedState.loanEstimate || JSON.stringify({ 
                ethPrice: 3500,
                floorPrice: 0.1,
                estimatedValueEth: 0.1,
                estimatedValueUsd: 350,
                ltvRatio: 30,
                recommendedLoanUsdt: 105,
                riskLevel: "Medium",
                liquidationThreshold: 45,
                interestRate: 10,
                maxLtv: 70,
                reasoning: ["Using default values due to limited data"]
              }),
              userQuery: toolCall.args.userQuery || "NFT loan inquiry"
            };
            
            console.error(`📊 Sending to report generator`);
            
            result = await reportGeneratorTool.invoke(reportArgs);
            if (result) {
              try {
                const parsed = JSON.parse(result);
                updatedState.report = result;
                console.error(`✅ Report stored in state, summary: ${parsed.summary || "N/A"}`);
              } catch (e) {
                console.error("Error parsing report result:", e);
                updatedState.report = result;
              }
            }
            break;
          }
          
          default:
            result = `Tool ${toolCall.name} not implemented`;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? (error as Error).message : String(error);
        console.error(`❌ Error executing tool ${toolCall.name}:`, msg);
        result = JSON.stringify({ 
          error: `Tool execution failed: ${msg}`,
          toolName: toolCall.name 
        });
      }
      
      newMessages.push(
        new ToolMessage({
          content: result || "No result from tool",
          tool_call_id: toolCall.id,
        })
      );
    }
    
    // Return updated state with all preserved values
    return { 
      messages: newMessages,
      nftData: updatedState.nftData,
      rarityScore: updatedState.rarityScore,
      loanEstimate: updatedState.loanEstimate,
      report: updatedState.report,
    };
  })
  
  .addConditionalEdges("agent", (state: AgentState) => {
    const lastMessage = state.messages[state.messages.length - 1] as any;
    const hasToolCalls = lastMessage?.tool_calls?.length > 0;
    return hasToolCalls ? "tools" : "__end__";
  })
  
  .addEdge("tools", "agent");

workflow.setEntryPoint("agent");
export const agentWorkflow = workflow.compile();

export async function evaluateNFTLoan(
  contract: string,
  tokenId: string,
  userQuery: string
): Promise<string> {
  console.error(`\n🚀 Starting NFT loan evaluation for ${contract}/${tokenId}`);
  
  const initialState: AgentState = {
    messages: [
      new HumanMessage({
        content: `You are an NFT lending underwriting agent. Evaluate this NFT for a USDT loan.

Contract: ${contract}
Token ID: ${tokenId}

Follow these steps in order:
1. First, call get_nft_metadata with the contract and tokenId
2. Then call analyze_rarity with the traits from step 1
3. Then call calculate_loan_estimate with floorPrice and rarityPremium
4. Finally call generate_lending_report with all the data

User query: "${userQuery}"`
      })
    ]
  };

  try {
    const result = await agentWorkflow.invoke(initialState);
    
    // Log final state for debugging
    console.error("\n📊 Final state check:");
    console.error(`   - nftData: ${result.nftData ? "✅" : "❌"}`);
    console.error(`   - rarityScore: ${result.rarityScore ? "✅" : "❌"}`);
    console.error(`   - loanEstimate: ${result.loanEstimate ? "✅" : "❌"}`);
    console.error(`   - report: ${result.report ? "✅" : "❌"}`);
    
    if (result.report) {
      try {
        const reportData = JSON.parse(result.report);
        console.error(`   - Report summary: ${reportData.summary || "N/A"}`);
        return reportData.report || "Report generated but content missing";
      } catch (e: unknown) {
        console.error("Error parsing final report:", e instanceof Error ? e.message : String(e));
        return result.report || "Report generated but could not be parsed";
      }
    }
    
    // If no report, try to get from messages
    const lastMessage = result.messages[result.messages.length - 1] as any;
    if (lastMessage && lastMessage.content) {
      return lastMessage.content;
    }
    
    return "No report could be generated. Please check the NFT data and try again.";
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? (error as Error).message : String(error);
    console.error("❌ Workflow error:", msg);
    return `Error generating loan assessment: ${msg}`;
  }
}