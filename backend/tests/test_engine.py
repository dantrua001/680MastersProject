import unittest

from app import engine, words
from app.engine import GameError

WORDS = {"HELLO", "OX", "XI", "CAT", "AT", "TRAINED"}


def new(n=2):
    words.set_words(WORDS)
    return engine.new_game([{"id": i + 1, "name": "P%d" % (i + 1)} for i in range(n)])


def tiles(word, row, col, direction="across", blanks=()):
    dr, dc = (0, 1) if direction == "across" else (1, 0)
    return [{"row": row + dr * i, "col": col + dc * i, "letter": ch, "blank": i in blanks} for i, ch in enumerate(word)]


def rack(state, pid, letters):
    state["racks"][str(pid)] = list(letters)


HELLO = tiles("HELLO", 7, 3)  # covers the star: (7,3) is a double letter, (7,7) a double word


class Setup(unittest.TestCase):
    def test_board_layout(self):
        kinds = list(engine.PREMIUM.values())
        self.assertEqual([kinds.count(k) for k in ("TW", "DW", "TL", "DL")], [8, 17, 12, 24])

    def test_tiles_and_racks(self):
        st = new(3)
        self.assertEqual(len(st["bag"]) + sum(len(r) for r in st["racks"].values()), 100)
        self.assertTrue(all(len(r) == 7 for r in st["racks"].values()))
        self.assertEqual(sum(engine.DIST.values()), 100)

    def test_players_only_see_their_own_rack(self):
        st = new()
        view = engine.view_for(st, 1)
        self.assertNotIn("bag", view)
        self.assertNotIn("racks", view)
        self.assertEqual(view["rack"], st["racks"]["1"])
        self.assertEqual(view["bag_count"], 86)


class BaseRules(unittest.TestCase):
    def test_first_move_score(self):
        st = new()
        rack(st, 1, "HELLOAB")
        engine.submit_move(st, 1, HELLO)
        self.assertEqual(st["players"][0]["score"], 24)  # (8+1+1+1+1) x 2
        self.assertEqual(len(st["racks"]["1"]), 7)  # refilled
        self.assertEqual(st["turn"], 1)

    def test_first_move_rules(self):
        st = new()
        rack(st, 1, "HELLOAB")
        with self.assertRaises(GameError):
            engine.submit_move(st, 1, tiles("HELLO", 0, 0))  # misses the star
        with self.assertRaises(GameError):
            engine.submit_move(st, 1, tiles("H", 7, 7))  # one tile
        with self.assertRaises(GameError):
            engine.submit_move(st, 1, tiles("HELOL", 7, 3))  # not a word
        with self.assertRaises(GameError):
            engine.submit_move(st, 2, HELLO)  # not your turn

    def test_must_own_the_tiles(self):
        st = new()
        rack(st, 1, "ABCDEFG")
        with self.assertRaises(GameError):
            engine.submit_move(st, 1, HELLO)

    def test_cross_word_and_connection(self):
        st = new()
        rack(st, 1, "HELLOAB")
        engine.submit_move(st, 1, HELLO)
        rack(st, 2, "XIABCDE")
        with self.assertRaises(GameError):
            engine.submit_move(st, 2, tiles("XI", 0, 0))  # floating
        res = engine.preview_move(st, 2, tiles("XI", 8, 7))
        self.assertEqual(sorted(w["word"] for w in res["words"]), ["OX", "XI"])
        self.assertEqual(res["score"], 19)  # XI = 8 + 1x2 (double letter) ; OX = 1 + 8

    def test_blank_scores_zero(self):
        st = new()
        rack(st, 1, "CA?ABCD")
        engine.submit_move(st, 1, tiles("CAT", 7, 6, blanks=(2,)))
        self.assertEqual(st["players"][0]["score"], 8)  # (3+1+0) x 2
        self.assertEqual(st["racks"]["1"][:4], list("ABCD"))  # C, A and the blank were used
        self.assertEqual(st["board"][7][8], {"l": "T", "b": True})

    def test_bingo_bonus(self):
        st = new()
        rack(st, 1, "TRAINED")
        res = engine.preview_move(st, 1, tiles("TRAINED", 7, 4))
        self.assertTrue(res["bingo"])
        self.assertEqual(res["score"], sum(w["score"] for w in res["words"]) + 50)

    def test_pass_exchange_and_rounds(self):
        st = new()
        old = list(st["racks"]["1"])
        engine.exchange(st, 1, old[:2])
        self.assertEqual(len(st["racks"]["1"]), 7)
        self.assertEqual(len(st["bag"]), 86)
        self.assertEqual(st["round"], 1)
        engine.pass_turn(st, 2)
        self.assertEqual(st["round"], 2)  # both players have now had a turn
        st["bag"] = st["bag"][:3]
        with self.assertRaises(GameError):
            engine.exchange(st, 1, [st["racks"]["1"][0]])

    def test_game_ends_after_two_full_rounds_of_passes(self):
        st = new()
        for pid in (1, 2, 1, 2):
            engine.pass_turn(st, pid)
        self.assertEqual(st["status"], "finished")
        self.assertTrue(st["winners"])
        with self.assertRaises(GameError):
            engine.pass_turn(st, 1)

    def test_going_out_scores_leftovers(self):
        st = new()
        st["bag"] = []
        rack(st, 1, "HELLO")
        rack(st, 2, "Q")
        engine.submit_move(st, 1, HELLO)
        self.assertEqual(st["status"], "finished")
        scores = {p["id"]: p["score"] for p in st["players"]}
        self.assertEqual(scores, {1: 34, 2: -10})
        self.assertEqual(st["winners"], [1])


class Blocking(unittest.TestCase):
    def setup_blocked(self, square):
        st = new()
        rack(st, 1, "HELLOAB")
        engine.place_block(st, 1, *square)  # player 1 blocks player 2's next turn
        engine.submit_move(st, 1, HELLO)
        rack(st, 2, "XIABCDE")
        return st

    def test_block_halves_every_word_using_the_square(self):
        st = self.setup_blocked((8, 7))  # X lands here: both XI and OX use it
        engine.submit_move(st, 2, tiles("XI", 8, 7))
        self.assertEqual(st["players"][1]["score"], 5 + 4)

    def test_block_halves_only_the_words_that_use_it(self):
        st = self.setup_blocked((8, 8))  # only XI passes through this square
        engine.submit_move(st, 2, tiles("XI", 8, 7))
        self.assertEqual(st["players"][1]["score"], 5 + 9)

    def test_block_lasts_one_turn_and_only_hits_the_target(self):
        st = self.setup_blocked((8, 7))
        self.assertEqual(st["block"]["target"], 2)
        self.assertEqual(engine.preview_move(st, 2, tiles("XI", 8, 7))["score"], 9)
        engine.pass_turn(st, 2)
        self.assertIsNone(st["block"])

    def test_block_rules(self):
        st = new()
        with self.assertRaises(GameError):
            engine.place_block(st, 2, 8, 7)  # in a 2-player game that would hit yourself
        engine.place_block(st, 1, 8, 7)
        with self.assertRaises(GameError):
            engine.place_block(st, 1, 9, 9)  # only one block at a time
        st["block"] = None
        with self.assertRaises(GameError):
            engine.place_block(st, 1, 9, 9)  # once per round
        engine.pass_turn(st, 1)
        engine.pass_turn(st, 2)
        engine.place_block(st, 1, 9, 9)  # new round

    def test_third_player_can_block_for_the_next_turn(self):
        st = new(3)
        engine.place_block(st, 3, 8, 7)  # P1 is up, so P2 is the target
        self.assertEqual(st["block"]["target"], 2)


class Assist(unittest.TestCase):
    def test_accept_then_player_submits(self):
        st = new()
        rack(st, 1, "HELLOAB")
        engine.suggest(st, 2, "hello", 7, 3, "across")
        with self.assertRaises(GameError):
            engine.suggest(st, 2, "OX", 7, 3, "across")  # once per turn
        placements = engine.respond_assist(st, 1, True)
        self.assertEqual("".join(p["letter"] for p in placements), "HELLO")
        self.assertEqual(st["players"][0]["score"], 0)  # nothing is played until they submit
        engine.submit_move(st, 1, placements)
        self.assertEqual(st["players"][0]["score"], 24)
        self.assertFalse(st["assist_used"])  # resets for the next turn

    def test_reject_and_rules(self):
        st = new()
        with self.assertRaises(GameError):
            engine.suggest(st, 1, "HELLO", 7, 3, "across")  # can't suggest to yourself
        with self.assertRaises(GameError):
            engine.suggest(st, 2, "ZZZZ", 7, 3, "across")  # not a word
        engine.suggest(st, 2, "HELLO", 7, 3, "across")
        engine.respond_assist(st, 1, False)
        self.assertIsNone(st["suggestion"])
        self.assertTrue(st["assist_used"])

    def test_suggestion_needs_the_tiles(self):
        st = new()
        rack(st, 1, "ZZZZZZZ")
        engine.suggest(st, 2, "HELLO", 7, 3, "across")
        with self.assertRaises(GameError):
            engine.respond_assist(st, 1, True)
        self.assertIsNotNone(st["suggestion"])  # still pending; they can reject it


class Trading(unittest.TestCase):
    def test_trade_swaps_tiles_and_limits_once_per_round(self):
        st = new()
        rack(st, 1, "ABCDEFG")
        rack(st, 2, "HIJKLMN")
        engine.propose_trade(st, 1, 2, "A")
        with self.assertRaises(GameError):
            engine.respond_trade(st, 1, True, "B")  # only the receiver can answer
        engine.respond_trade(st, 2, True, "H")
        self.assertIn("H", st["racks"]["1"])
        self.assertIn("A", st["racks"]["2"])
        self.assertEqual((len(st["racks"]["1"]), len(st["racks"]["2"])), (7, 7))
        with self.assertRaises(GameError):
            engine.propose_trade(st, 1, 2, "B")
        engine.propose_trade(st, 2, 1, "I")  # the other player still has their trade

    def test_declined_trade_does_not_use_the_allowance(self):
        st = new()
        rack(st, 1, "ABCDEFG")
        engine.propose_trade(st, 1, 2, "A")
        engine.respond_trade(st, 2, False)
        engine.propose_trade(st, 1, 2, "B")
        engine.cancel_trade(st, 1)
        self.assertIsNone(st["trade"])


class Resign(unittest.TestCase):
    def test_two_player_resign_ends_the_game(self):
        st = new()
        engine.resign(st, 2)
        self.assertEqual(st["status"], "finished")
        self.assertEqual(st["winners"], [1])
        self.assertIn("resigned", st["ended_reason"])
        with self.assertRaises(GameError):
            engine.resign(st, 2)

    def test_three_player_resign_skips_that_seat(self):
        st = new(3)
        engine.resign(st, 2)  # it's P1's turn; P2 resigns, so play should skip to P3
        self.assertEqual(st["status"], "active")
        rack(st, 1, "HELLOAB")
        engine.submit_move(st, 1, HELLO)
        self.assertEqual(st["players"][st["turn"]]["id"], 3)
        with self.assertRaises(GameError):
            engine.pass_turn(st, 2)  # resigned players can't act

    def test_resigning_clears_your_pending_block_or_trade(self):
        st = new(3)
        engine.place_block(st, 1, 8, 7)  # blocks P2
        engine.resign(st, 1)
        self.assertIsNone(st["block"])


class Logging(unittest.TestCase):
    def test_move_log_entry_has_tiles_and_score(self):
        st = new()
        rack(st, 1, "HELLOAB")
        engine.submit_move(st, 1, HELLO)
        entry = st["log"][-1]
        self.assertEqual(entry["pid"], 1)
        self.assertEqual(entry["score"], 24)
        self.assertEqual([t["letter"] for t in entry["tiles"]], list("HELLO"))
        self.assertIn("t", entry)

    def test_bag_letter_mix_is_visible_but_not_the_letters_themselves(self):
        st = new()
        view = engine.view_for(st, 1)
        blanks_left = st["bag"].count("?")
        self.assertEqual(view["bag_vowels"] + view["bag_consonants"] + blanks_left, view["bag_count"])
        self.assertNotIn("bag", view)


class Chat(unittest.TestCase):
    def test_chat_is_stored(self):
        st = new()
        engine.add_chat(st, 2, "  good   luck ")
        self.assertEqual(st["chat"][0]["text"], "good luck")


if __name__ == "__main__":
    unittest.main()
